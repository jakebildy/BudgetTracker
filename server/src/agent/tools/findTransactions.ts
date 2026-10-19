import { formatDollars, TransactionTypeSchema } from "@budget/shared";
import { z } from "zod";
import { cleanSearch, ToolFilterFields, toCriteria } from "./criteria";
import { defineTool } from "./defineTool";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

export const findTransactions = defineTool({
  name: "find_transactions",
  description:
    "Lists individual transactions that match the filters, newest first, with their ids. " +
    "Use it to show or cite specific transactions, and always before proposing an edit or delete, " +
    "so you have the right ids. Turn any period in the question into fromDate and toDate. " +
    "Returns at most 25; matchCount tells you if there were more.",
  input: z.object({
    type: TransactionTypeSchema.optional().describe("Only income or only expenses. Omit for both."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .optional()
      .describe("How many to return, 1 to 25. Default 10."),
    ...ToolFilterFields,
  }),
  statusLabel: ({ search }) => {
    const searched = cleanSearch(search);
    return searched ? `Looking up “${searched}”` : "Looking up transactions";
  },
  run: async ({ type, limit, ...filters }, context) => {
    const matches = await context.transactions.list({ ...toCriteria(filters), ...(type && { type }) });
    return {
      matchCount: matches.length,
      transactions: matches.slice(0, Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT)).map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        amount: formatDollars(transaction.amount),
        type: transaction.type,
        category: transaction.category,
      })),
    };
  },
});
