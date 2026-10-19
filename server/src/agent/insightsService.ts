// Answers one Ask AI question. The scope check and the agent start together;
// the agent's output is held back until the check says the question is in scope.
import { type AgentEvent, type ChatTurn, OFF_TOPIC_REPLY } from "@budget/shared";
import type { Clock } from "../clock";
import { AiUnavailableError, AppError } from "../errors";
import type { LlmClient } from "../llm/types";
import type { ProposalService } from "../services/proposalService";
import type { SummaryService } from "../services/summaryService";
import type { TransactionService } from "../services/transactionService";
import { type AgentLimits, type AgentResult, DEFAULT_LIMITS, runAgent } from "./harness";
import { HeldEvents } from "./heldEvents";
import { buildMessages } from "./prompt";
import { ScopeGate } from "./scopeGate";
import { toolNote } from "./toolNote";
import { AGENT_TOOLS } from "./tools";
import { type AgentTool, ToolError } from "./tools/defineTool";

const REQUEST_TIMEOUT_MS = 25_000;

export type InsightsDependencies = {
  llm: LlmClient | null;
  agentModel: string;
  fastModel: string;
  transactions: TransactionService;
  summary: SummaryService;
  proposals: ProposalService;
  clock: Clock;
  tools?: readonly AgentTool[];
  limits?: AgentLimits;
  scopeTimeoutMs?: number;
};

export type Question = {
  question: string;
  month: string;
  history: readonly ChatTurn[];
};

export class InsightsService {
  constructor(private readonly deps: InsightsDependencies) {}

  /** Throws before any streaming starts, so the route can answer with a normal JSON error. */
  assertAvailable(): void {
    this.requireLlm();
  }

  /** Streams events through `send`. Returns the agent's result for in-scope questions (used by evals). */
  async ask(
    input: Question,
    send: (event: AgentEvent) => void,
    clientSignal: AbortSignal,
  ): Promise<AgentResult | null> {
    const llm = this.requireLlm();
    const { transactions, summary, proposals, clock } = this.deps;
    send({ type: "status", label: "Thinking…" });

    const signal = AbortSignal.any([clientSignal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
    const stopAgent = new AbortController();
    const held = new HeldEvents(send);

    const verdict = new ScopeGate(llm, this.deps.fastModel, this.deps.scopeTimeoutMs).check(
      input.question,
      input.history,
      signal,
    );
    const scope = verdict.then(({ scope }) => scope);
    const messages = buildMessages(input.question, input.history, {
      today: clock.today(),
      selectedMonth: input.month,
      monthsWithData: await transactions.months(),
    });

    const agentRun = runAgent(
      llm,
      {
        model: this.deps.agentModel,
        messages,
        tools: this.deps.tools ?? AGENT_TOOLS,
        limits: this.deps.limits ?? DEFAULT_LIMITS,
        emit: held.emit,
        toolContext: {
          transactions,
          summary,
          proposals,
          today: clock.today(),
          waitForScope: async () => {
            if ((await scope) === "off_topic") throw new ToolError("This question is out of scope.");
          },
        },
      },
      AbortSignal.any([signal, stopAgent.signal]),
    ).then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error }),
    );

    if ((await scope) === "off_topic") {
      stopAgent.abort();
      held.discard();
      await agentRun;
      send({ type: "text", delta: OFF_TOPIC_REPLY });
      send({ type: "done", offTopic: true, toolsUsed: [], toolNote: null, followUps: [] });
      return null;
    }

    held.release();
    const outcome = await agentRun;
    if (!outcome.ok) {
      if (!clientSignal.aborted) send({ type: "error", message: describeFailure(outcome.error, signal) });
      return null;
    }

    const { result } = outcome;
    logRun(input.question, result);
    send({
      type: "done",
      offTopic: false,
      toolsUsed: [...new Set(result.toolCalls.map((call) => call.name))],
      toolNote: toolNote(result.toolCalls),
      followUps: (await verdict).followUps,
    });
    return result;
  }

  private requireLlm(): LlmClient {
    if (!this.deps.llm)
      throw new AiUnavailableError("Add ANTHROPIC_API_KEY to server/.env to enable Ask AI.");
    return this.deps.llm;
  }
}

function describeFailure(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) return "That took too long to answer. Try a narrower question.";
  if (error instanceof AppError) return error.message;
  console.error("Ask AI failed:", error);
  return "Something went wrong while answering. Try again.";
}

function logRun(question: string, result: AgentResult): void {
  const tools =
    result.toolCalls.map((call) => `${call.name}${call.isError ? "(error)" : ""}`).join(", ") || "none";
  console.info(
    `[ask-ai] "${question.slice(0, 60)}" tools=${tools} tokens=${result.usage.inputTokens}/${result.usage.outputTokens} ` +
      `stopped=${result.stoppedBecause} grounded=${result.grounding.grounded}`,
  );
  if (!result.grounding.grounded) {
    console.warn("[ask-ai] numbers not found in tool results:", result.grounding.unmatched.join(", "));
  }
}
