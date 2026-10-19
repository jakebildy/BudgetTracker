// The agent loop: ask the model, run the tools it calls, send back the results,
// and repeat until it answers or a limit is reached. Text streams to the client
// as it arrives; every run produces a trace for logs and evals.
import type { AgentEvent } from "@budget/shared";
import { ZodError, z } from "zod";
import { AppError } from "../errors";
import type { LlmClient, LlmContentBlock, LlmMessage, LlmTurnEvent } from "../llm/types";
import { DatasetStore } from "./datasets";
import { checkGrounding, type GroundingReport } from "./grounding";
import { SYSTEM_PROMPT } from "./prompt";
import { type AgentTool, type ToolContext, ToolError } from "./tools/defineTool";

export type AgentLimits = {
  maxTurns: number;
  maxOutputTokensPerTurn: number;
  toolTimeoutMs: number;
};

export const DEFAULT_LIMITS: AgentLimits = { maxTurns: 6, maxOutputTokensPerTurn: 1024, toolTimeoutMs: 5000 };

export type AgentRunInput = {
  model: string;
  messages: LlmMessage[];
  tools: readonly AgentTool[];
  /** Everything a tool needs except the per-run dataset store and event sink, which the harness adds. */
  toolContext: Omit<ToolContext, "datasets" | "emit" | "earlierResults">;
  emit: (event: AgentEvent) => void;
  limits?: AgentLimits;
};

export type ToolCallTrace = {
  name: string;
  input: unknown;
  output: string;
  isError: boolean;
  durationMs: number;
};

export type AgentResult = {
  answer: string;
  stoppedBecause: "answered" | "turn_limit" | "token_limit";
  toolCalls: ToolCallTrace[];
  usage: { inputTokens: number; outputTokens: number };
  grounding: GroundingReport;
};

export const TURN_LIMIT_REPLY =
  "I couldn't finish working that out. Try narrowing the question to one month or one category.";

export async function runAgent(
  llm: LlmClient,
  input: AgentRunInput,
  signal: AbortSignal,
): Promise<AgentResult> {
  const limits = input.limits ?? DEFAULT_LIMITS;
  const toolCalls: ToolCallTrace[] = [];
  const context: ToolContext = {
    ...input.toolContext,
    datasets: new DatasetStore(),
    emit: input.emit,
    earlierResults: () => toolCalls.filter((call) => !call.isError).map((call) => call.output),
  };
  const toolsByName = new Map(input.tools.map((tool) => [tool.name, tool]));
  const messages = [...input.messages];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let answer = "";

  const finish = (stoppedBecause: AgentResult["stoppedBecause"]): AgentResult => ({
    answer,
    stoppedBecause,
    toolCalls,
    usage,
    grounding: checkGrounding(
      answer,
      toolCalls.map((call) => call.output),
    ),
  });

  for (let turn = 0; turn < limits.maxTurns; turn++) {
    let turnHasText = false;
    const completed = await streamOneTurn(llm, input, messages, limits, signal, (text) => {
      // Separate text from different turns, e.g. "Let me check." and the final answer.
      const separator = !turnHasText && answer !== "" ? "\n\n" : "";
      turnHasText = true;
      answer += separator + text;
      input.emit({ type: "text", delta: separator + text });
    });
    usage.inputTokens += completed.usage.inputTokens;
    usage.outputTokens += completed.usage.outputTokens;
    messages.push(completed.message);

    const calls = completed.message.content.filter((block) => block.type === "tool_call");
    if (calls.length === 0) {
      return finish(completed.stopReason === "max_tokens" ? "token_limit" : "answered");
    }

    const results: LlmContentBlock[] = [];
    for (const call of calls) {
      const trace = await runToolCall(call, toolsByName, context, limits.toolTimeoutMs, input.emit);
      toolCalls.push(trace);
      results.push({
        type: "tool_result",
        toolCallId: call.id,
        content: trace.output,
        isError: trace.isError,
      });
    }
    messages.push({ role: "user", content: results });
  }

  const separator = answer ? "\n\n" : "";
  answer += separator + TURN_LIMIT_REPLY;
  input.emit({ type: "text", delta: separator + TURN_LIMIT_REPLY });
  return finish("turn_limit");
}

async function streamOneTurn(
  llm: LlmClient,
  input: AgentRunInput,
  messages: readonly LlmMessage[],
  limits: AgentLimits,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<Extract<LlmTurnEvent, { type: "turn_complete" }>> {
  const request = {
    model: input.model,
    system: SYSTEM_PROMPT,
    messages,
    tools: input.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
    maxTokens: limits.maxOutputTokensPerTurn,
  };
  for await (const event of llm.streamTurn(request, signal)) {
    if (event.type === "text_delta") onText(event.text);
    else return event;
  }
  throw new Error("The model stream ended without completing the turn.");
}

async function runToolCall(
  call: Extract<LlmContentBlock, { type: "tool_call" }>,
  toolsByName: ReadonlyMap<string, AgentTool>,
  context: ToolContext,
  timeoutMs: number,
  emit: (event: AgentEvent) => void,
): Promise<ToolCallTrace> {
  const started = Date.now();
  const trace = (output: string, isError: boolean): ToolCallTrace => ({
    name: call.name,
    input: call.input,
    output,
    isError,
    durationMs: Date.now() - started,
  });

  const tool = toolsByName.get(call.name);
  if (!tool) return trace(`There is no tool called ${call.name}.`, true);

  try {
    const prepared = tool.prepare(call.input);
    emit({ type: "status", label: prepared.statusLabel });
    const result = await withTimeout(prepared.run(context), timeoutMs);
    return trace(JSON.stringify(result), false);
  } catch (error) {
    return trace(messageForModel(error), true);
  }
}

/** Errors the model can learn from are passed through; anything unexpected is logged and summarized. */
function messageForModel(error: unknown): string {
  if (error instanceof ZodError) return `Invalid input: ${z.prettifyError(error)}`;
  if (error instanceof ToolError || error instanceof AppError) return error.message;
  if (error instanceof TimeoutError) return "The tool took too long. Try a narrower request.";
  console.error("Agent tool failed:", error);
  return "The tool failed unexpectedly.";
}

class TimeoutError extends Error {}

function withTimeout<Value>(promise: Promise<Value>, ms: number): Promise<Value> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
