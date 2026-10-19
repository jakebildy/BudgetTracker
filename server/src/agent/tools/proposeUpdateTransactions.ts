import {
  AmountSchema,
  CategorySchema,
  DescriptionSchema,
  IsoDateSchema,
  TransactionTypeSchema,
} from "@budget/shared";
import { z } from "zod";
import { defineTool } from "./defineTool";
import { proposalResult } from "./proposalResult";

export const proposeUpdateTransactions = defineTool({
  name: "propose_update_transactions",
  description:
    "Proposes editing one or more existing transactions, for example recategorizing every Uber ride as Transport. " +
    "Get the ids from find_transactions first. Include only the fields that change. " +
    "Nothing is saved until the user approves it in the app.",
  input: z.object({
    changes: z
      .array(
        z.object({
          id: z.string().describe("Transaction id from find_transactions."),
          date: IsoDateSchema.optional(),
          description: DescriptionSchema.optional(),
          amount: AmountSchema.optional(),
          type: TransactionTypeSchema.optional(),
          category: CategorySchema.optional(),
        }),
      )
      .min(1)
      .max(50),
  }),
  statusLabel: ({ changes }) =>
    changes.length === 1 ? "Preparing an edit" : `Preparing edits to ${changes.length} transactions`,
  run: async ({ changes }, context) => {
    await context.waitForScope();
    const proposal = await context.proposals.proposeUpdates(changes);
    context.emit({ type: "proposal", proposal });
    return proposalResult(proposal);
  },
});
