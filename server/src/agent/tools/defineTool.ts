// How an agent tool is declared: a Zod input schema, a status label for the UI, and a run function.
import type { AgentEvent, IsoDate } from "@budget/shared";
import type { z } from "zod";
import { toModelJsonSchema } from "../../llm/jsonSchema";
import type { JsonSchema } from "../../llm/types";
import type { ProposalService } from "../../services/proposalService";
import type { SummaryService } from "../../services/summaryService";
import type { TransactionService } from "../../services/transactionService";
import type { DatasetStore } from "../datasets";

export type ToolContext = {
  transactions: TransactionService;
  summary: SummaryService;
  proposals: ProposalService;
  datasets: DatasetStore;
  today: IsoDate;
  /** Sends a chart or proposal to the client as part of the answer. */
  emit: (event: AgentEvent) => void;
  /** Outputs of the tool calls that succeeded so far in this answer. add_or_subtract checks its inputs against them. */
  earlierResults: () => readonly string[];
  /** Resolves when the scope check passes; rejects if the question was off topic. Write tools wait on it. */
  waitForScope: () => Promise<void>;
};

/** A tool after its input has been validated, ready to run. */
export type PreparedToolCall = {
  statusLabel: string;
  run: (context: ToolContext) => Promise<unknown>;
};

export type AgentTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** Validates raw model input. Throws a ZodError the harness reports back to the model. */
  prepare: (rawInput: unknown) => PreparedToolCall;
};

type ToolDefinition<Schema extends z.ZodType> = {
  name: string;
  description: string;
  input: Schema;
  statusLabel: (input: z.infer<Schema>) => string;
  run: (input: z.infer<Schema>, context: ToolContext) => Promise<unknown>;
};

export function defineTool<Schema extends z.ZodType>(definition: ToolDefinition<Schema>): AgentTool {
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: toModelJsonSchema(definition.input),
    prepare: (rawInput) => {
      const input = definition.input.parse(rawInput);
      return {
        statusLabel: definition.statusLabel(input),
        run: (context) => definition.run(input, context),
      };
    },
  };
}

/** Thrown by a tool when the model asked for something it can fix, such as a chart that doesn't fit the data. */
export class ToolError extends Error {}
