// The only file that imports the Anthropic SDK. It translates between the SDK's
// types and the provider-neutral types in ./types.
import Anthropic from "@anthropic-ai/sdk";
import { AiUnavailableError } from "../errors";
import type {
  LlmClient,
  LlmContentBlock,
  LlmMessage,
  LlmStopReason,
  LlmTurnEvent,
  LlmTurnRequest,
  StructuredRequest,
} from "./types";

export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2 });
  }

  async *streamTurn(request: LlmTurnRequest, signal: AbortSignal): AsyncIterable<LlmTurnEvent> {
    const stream = this.client.messages.stream(
      {
        model: request.model,
        max_tokens: request.maxTokens,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: request.messages.map(toAnthropicMessage),
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: { type: "object", ...tool.inputSchema },
          strict: true,
        })),
      },
      { signal },
    );

    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text_delta", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      yield {
        type: "turn_complete",
        message: { role: "assistant", content: final.content.map(fromAnthropicBlock) },
        stopReason: toStopReason(final.stop_reason),
        usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens },
      };
    } catch (error) {
      throw toAppError(error);
    }
  }

  async completeStructured(request: StructuredRequest, signal?: AbortSignal): Promise<unknown> {
    try {
      const response = await this.client.messages.create(
        {
          model: request.model,
          max_tokens: request.maxTokens,
          // A structured answer needs no reasoning. Thinking used up the small token budget on
          // borderline questions, which cut the JSON short or left no answer at all.
          thinking: { type: "disabled" },
          system: request.system,
          messages: [{ role: "user", content: request.prompt }],
          output_config: { format: { type: "json_schema", schema: request.schema } },
        },
        signal ? { signal } : {},
      );
      const text = response.content.find((block) => block.type === "text");
      if (!text) {
        throw new AiUnavailableError(
          `The model returned no structured output (stop reason: ${response.stop_reason ?? "none"}).`,
        );
      }
      return JSON.parse(text.text);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

function toAnthropicMessage(message: LlmMessage): Anthropic.MessageParam {
  return { role: message.role, content: message.content.map(toAnthropicBlock) };
}

function toAnthropicBlock(block: LlmContentBlock): Anthropic.ContentBlockParam {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "tool_call":
      return { type: "tool_use", id: block.id, name: block.name, input: block.input };
    case "tool_result":
      return {
        type: "tool_result",
        tool_use_id: block.toolCallId,
        content: block.content,
        is_error: block.isError,
      };
    case "provider_block":
      // Thinking blocks are returned to the API exactly as it sent them.
      return block.raw as Anthropic.ContentBlockParam;
  }
}

function fromAnthropicBlock(block: Anthropic.ContentBlock): LlmContentBlock {
  if (block.type === "text") return { type: "text", text: block.text };
  if (block.type === "tool_use")
    return { type: "tool_call", id: block.id, name: block.name, input: block.input };
  return { type: "provider_block", raw: block };
}

function toStopReason(reason: Anthropic.StopReason | null): LlmStopReason {
  if (reason === "tool_use" || reason === "end_turn" || reason === "max_tokens") return reason;
  return "other";
}

function toAppError(error: unknown): unknown {
  if (error instanceof Anthropic.APIUserAbortError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new AiUnavailableError(
      "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in server/.env.",
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiUnavailableError("The AI service is rate limited right now. Try again in a minute.");
  }
  if (error instanceof Anthropic.APIError) {
    return new AiUnavailableError(`The AI service returned an error: ${error.message}`);
  }
  return error;
}
