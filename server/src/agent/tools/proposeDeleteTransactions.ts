import { z } from "zod";
import { defineTool } from "./defineTool";
import { proposalResult } from "./proposalResult";

export const proposeDeleteTransactions = defineTool({
  name: "propose_delete_transactions",
  description:
    "Proposes deleting one or more transactions. Get the ids from find_transactions first, and if several " +
    "transactions could match the user's request, ask which one they mean instead of guessing. " +
    "Nothing is deleted until the user approves it in the app.",
  input: z.object({
    ids: z.array(z.string()).min(1).max(50).describe("Transaction ids from find_transactions."),
  }),
  statusLabel: ({ ids }) =>
    ids.length === 1 ? "Preparing a delete" : `Preparing to delete ${ids.length} transactions`,
  run: async ({ ids }, context) => {
    await context.waitForScope();
    const proposal = await context.proposals.proposeDeletes(ids);
    context.emit({ type: "proposal", proposal });
    return proposalResult(proposal);
  },
});
