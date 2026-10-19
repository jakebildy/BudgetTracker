// npm run eval: runs every case in cases.ts against the real model and prints a report.
// Needs ANTHROPIC_API_KEY in server/.env. Each case gets a fresh copy of the seed data.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentEvent, ChartKind, ChatTurn } from "@budget/shared";
import { fixedClock } from "../src/clock";
import { loadConfig } from "../src/config";
import { buildDependencies } from "../src/container";
import { AnthropicLlmClient } from "../src/llm/anthropicClient";
import { InMemoryTransactionRepository } from "../src/repositories/inMemoryRepository";
import { seedTransactions } from "../test/support/testApp";
import { EVAL_CASES, type EvalCase } from "./cases";

type CaseResult = {
  name: string;
  passed: boolean;
  failures: string[];
  answer: string;
  toolsUsed: string[];
  followUps: string[];
  grounded: boolean | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  /** Every tool call with its input and output, to see why a case failed. */
  toolCalls: { name: string; input: unknown; output: string; isError: boolean }[];
};

const config = loadConfig();
if (!config.anthropicApiKey) {
  console.error("Set ANTHROPIC_API_KEY in server/.env to run the evals.");
  process.exit(1);
}
const llm = new AnthropicLlmClient(config.anthropicApiKey);

const only = process.argv[2];
const cases = only ? EVAL_CASES.filter((testCase) => testCase.name.includes(only)) : EVAL_CASES;
const results: CaseResult[] = [];

for (const testCase of cases) {
  const result = await runCase(testCase);
  results.push(result);
  console.log(
    `${result.passed ? color("PASS", "green") : color("FAIL", "red")}  ${testCase.name} (${result.latencyMs} ms)`,
  );
  for (const failure of result.failures) console.log(`      - ${failure}`);
  if (!result.passed) {
    for (const call of result.toolCalls) {
      console.log(`      ${call.isError ? "x" : ">"} ${call.name} ${JSON.stringify(call.input)}`);
      console.log(`        ${call.output.slice(0, 300)}`);
    }
    console.log(`      answer: ${result.answer}`);
  }
}

const passed = results.filter((result) => result.passed).length;
const grounded = results.filter((result) => result.grounded !== null);
const totalIn = results.reduce((sum, result) => sum + result.inputTokens, 0);
const totalOut = results.reduce((sum, result) => sum + result.outputTokens, 0);
const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);

console.log(`
Model:            ${config.agentModel} (scope check: ${config.fastModel})
Passed:           ${passed}/${results.length}
Grounded answers: ${grounded.filter((result) => result.grounded).length}/${grounded.length}
Median latency:   ${latencies[Math.floor(latencies.length / 2)] ?? 0} ms
Agent tokens:     ${totalIn} in / ${totalOut} out (scope checks not included)`);

const reportPath = path.resolve(import.meta.dirname, "last-run.json");
await writeFile(reportPath, `${JSON.stringify({ model: config.agentModel, results }, null, 2)}\n`);
console.log(`Full report: ${reportPath}`);
process.exit(passed === results.length ? 0 : 1);

async function runCase(testCase: EvalCase): Promise<CaseResult> {
  const { insights } = buildDependencies({
    repository: new InMemoryTransactionRepository(seedTransactions()),
    clock: fixedClock("2026-10-15T18:00:00.000Z"),
    llm,
    models: { agent: config.agentModel, fast: config.fastModel },
  });

  // A follow-up case asks the first question for real, then asks the follow-up with that
  // exchange as history (including the tool note, as the client sends it). Expectations
  // apply to the follow-up answer.
  const history: ChatTurn[] = [];
  if (testCase.followUp) {
    const first: AgentEvent[] = [];
    await insights.ask(
      { question: testCase.question, month: "2026-10", history: [] },
      (event) => first.push(event),
      new AbortController().signal,
    );
    const firstDone = first.find((event) => event.type === "done");
    const note = firstDone?.type === "done" && firstDone.toolNote ? `\n\n[${firstDone.toolNote}]` : "";
    const firstAnswer = first.flatMap((event) => (event.type === "text" ? [event.delta] : [])).join("");
    history.push({ role: "user", text: testCase.question }, { role: "assistant", text: firstAnswer + note });
  }

  const events: AgentEvent[] = [];
  const started = Date.now();
  const agentResult = await insights.ask(
    {
      question: testCase.followUp ?? testCase.question,
      month: "2026-10",
      history,
    },
    (event) => events.push(event),
    new AbortController().signal,
  );
  const latencyMs = Date.now() - started;

  const answer = events.flatMap((event) => (event.type === "text" ? [event.delta] : [])).join("");
  const done = events.find((event) => event.type === "done");
  const charts = events.flatMap((event) => (event.type === "chart" ? [event.chart.kind] : []));
  const proposals = events.flatMap((event) => (event.type === "proposal" ? [event.proposal] : []));
  const toolsUsed = done?.type === "done" ? done.toolsUsed : [];
  const followUps = done?.type === "done" ? done.followUps : [];
  const failures = checkExpectations(testCase, {
    answer,
    done,
    charts,
    proposals,
    toolsUsed,
    followUps,
    events,
  });

  if (agentResult && !agentResult.grounding.grounded) {
    failures.push(`numbers not found in tool results: ${agentResult.grounding.unmatched.join(", ")}`);
  }

  return {
    name: testCase.name,
    passed: failures.length === 0,
    failures,
    answer,
    toolsUsed,
    followUps,
    grounded: agentResult ? agentResult.grounding.grounded : null,
    latencyMs,
    inputTokens: agentResult?.usage.inputTokens ?? 0,
    outputTokens: agentResult?.usage.outputTokens ?? 0,
    toolCalls: (agentResult?.toolCalls ?? []).map(({ name, input, output, isError }) => ({
      name,
      input,
      output,
      isError,
    })),
  };
}

function checkExpectations(
  testCase: EvalCase,
  observed: {
    answer: string;
    done: AgentEvent | undefined;
    charts: ChartKind[];
    proposals: { operations: { kind: string }[] }[];
    toolsUsed: string[];
    followUps: string[];
    events: AgentEvent[];
  },
): string[] {
  const { expect } = testCase;
  const failures: string[] = [];
  const error = observed.events.find((event) => event.type === "error");
  if (error?.type === "error") failures.push(`error event: ${error.message}`);

  const offTopic = observed.done?.type === "done" && observed.done.offTopic;
  if (expect.offTopic !== undefined && offTopic !== expect.offTopic) {
    failures.push(`expected offTopic=${expect.offTopic}, got ${offTopic}`);
  }
  for (const tool of expect.toolsInclude ?? []) {
    if (!observed.toolsUsed.includes(tool))
      failures.push(`expected tool ${tool}, used [${observed.toolsUsed.join(", ")}]`);
  }
  for (const pattern of expect.answerIncludes ?? []) {
    if (!matches(observed.answer, pattern)) failures.push(`answer should include ${pattern}`);
  }
  for (const pattern of expect.answerExcludes ?? []) {
    if (matches(observed.answer, pattern)) failures.push(`answer should not include ${pattern}`);
  }
  if (expect.chartKinds === null && observed.charts.length > 0) failures.push("expected no chart");
  if (expect.chartKinds && !observed.charts.some((kind) => expect.chartKinds?.includes(kind))) {
    failures.push(`expected a ${expect.chartKinds.join(" or ")} chart, got [${observed.charts.join(", ")}]`);
  }
  if (expect.proposal === null && observed.proposals.length > 0) failures.push("expected no proposal");
  if (
    expect.proposal &&
    !observed.proposals.some((p) => p.operations.every((op) => op.kind === expect.proposal))
  ) {
    failures.push(`expected a ${expect.proposal} proposal`);
  }
  if (expect.followUps === true && observed.followUps.length === 0) failures.push("expected follow-ups");
  if (expect.followUps === false && observed.followUps.length > 0) {
    failures.push(`expected no follow-ups, got [${observed.followUps.join(" | ")}]`);
  }
  return failures;
}

function matches(text: string, pattern: string | RegExp): boolean {
  return typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);
}

/** Colors text in a terminal, and leaves it plain when piped to a file or NO_COLOR is set. */
function color(text: string, name: "green" | "red"): string {
  if (!process.stdout.isTTY || process.env.NO_COLOR) return text;
  const code = name === "green" ? 32 : 31;
  return `\x1b[${code}m${text}\x1b[0m`;
}
