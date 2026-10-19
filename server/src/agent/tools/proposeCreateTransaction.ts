import { TransactionInputSchema } from "@budget/shared";
import { defineTool } from "./defineTool";
import { proposalResult } from "./proposalResult";

export const proposeCreateTransaction = defineTool({
  name: "propose_create_transaction",
  description:
    "Proposes adding one transaction. Nothing is saved until the user approves it in the app. " +
    "The category must belong to the type (expense categories for expenses, income categories for income). " +
    "If the user didn't give a date, use today's date from the context.",
  input: TransactionInputSchema,
  statusLabel: (input) => `Preparing to add “${input.description}”`,
  run: async (input, context) => {
    await context.waitForScope();
    const proposal = context.proposals.proposeCreate(input);
    context.emit({ type: "proposal", proposal });
    return proposalResult(proposal);
  },
});
