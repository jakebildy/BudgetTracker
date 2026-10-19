// A scripted stand-in for the model, so tests run without an API key and always behave the same way.
import type {
  LlmClient,
  LlmContentBlock,
  LlmMessage,
  LlmTurnEvent,
  LlmTurnRequest,
  StructuredRequest,
} from "../../src/llm/types";

/** What the fake model says on one turn: optional text, then optional tool calls. */
export type ScriptedTurn = {
  text?: string;
  toolCalls?: { name: string; input: unknown }[];
  /** Wait this long before answering, to test timing between the agent and the scope gate. */
  delayMs?: number;
};

export class ScriptedLlmClient implements LlmClient {
  readonly turnRequests: LlmTurnRequest[] = [];
  readonly structuredRequests: StructuredRequest[] = [];
  private nextCallId = 1;

  constructor(
    private readonly turns: ScriptedTurn[] = [],
    private readonly structured: (request: StructuredRequest) => unknown | Promise<unknown> = () => {
      throw new Error("No structured response scripted.");
    },
  ) {}

  async *streamTurn(request: LlmTurnRequest, signal: AbortSignal): AsyncIterable<LlmTurnEvent> {
    this.turnRequests.push({ ...request, messages: [...request.messages] });
    const turn = this.turns.shift();
    if (!turn) throw new Error("The scripted model ran out of turns.");
    if (turn.delayMs) await sleep(turn.delayMs, signal);

    const content: LlmContentBlock[] = [];
    if (turn.text) {
      for (const word of turn.text.split(/(?<= )/)) yield { type: "text_delta", text: word };
      content.push({ type: "text", text: turn.text });
    }
    for (const call of turn.toolCalls ?? []) {
      content.push({
        type: "tool_call",
        id: `call_${this.nextCallId++}`,
        name: call.name,
        input: call.input,
      });
    }
    const message: LlmMessage = { role: "assistant", content };
    yield {
      type: "turn_complete",
      message,
      stopReason: turn.toolCalls?.length ? "tool_use" : "end_turn",
      usage: { inputTokens: 100, outputTokens: 20 },
    };
  }

  async completeStructured(request: StructuredRequest): Promise<unknown> {
    this.structuredRequests.push(request);
    return this.structured(request);
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}
