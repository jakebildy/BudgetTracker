// A provider-neutral view of a chat model. The agent and the scope check depend on
// this interface; only llm/anthropicClient.ts knows about the Anthropic SDK.

export type JsonSchema = Record<string, unknown>;

export type LlmContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; toolCallId: string; content: string; isError: boolean }
  /** Provider-specific blocks (such as thinking) that must be sent back unchanged. */
  | { type: "provider_block"; raw: unknown };

export type LlmMessage = { role: "user" | "assistant"; content: LlmContentBlock[] };

export type LlmTool = { name: string; description: string; inputSchema: JsonSchema };

export type LlmTurnRequest = {
  model: string;
  system: string;
  messages: readonly LlmMessage[];
  tools: readonly LlmTool[];
  maxTokens: number;
};

export type LlmStopReason = "tool_use" | "end_turn" | "max_tokens" | "other";

export type LlmTurnEvent =
  | { type: "text_delta"; text: string }
  | {
      type: "turn_complete";
      message: LlmMessage;
      stopReason: LlmStopReason;
      usage: { inputTokens: number; outputTokens: number };
    };

export type StructuredRequest = {
  model: string;
  system: string;
  prompt: string;
  schema: JsonSchema;
  maxTokens: number;
};

export interface LlmClient {
  /** Runs one model turn, streaming text as it arrives and finishing with the complete message. */
  streamTurn(request: LlmTurnRequest, signal: AbortSignal): AsyncIterable<LlmTurnEvent>;
  /** Returns JSON matching `schema`. Callers still validate it with Zod. */
  completeStructured(request: StructuredRequest, signal?: AbortSignal): Promise<unknown>;
}
