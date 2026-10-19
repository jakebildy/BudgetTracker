import { formatDollars, TransactionTypeSchema } from "@budget/shared";
import { z } from "zod";
import { cleanSearch, describeRange, ToolFilterFields, toCriteria } from "./criteria";
import { defineTool } from "./defineTool";

export const sumTransactions = defineTool({
  name: "sum_transactions",
  description:
    "Adds up transactions of one type that match the filters, optionally grouped by month or category. " +
    "Use it for questions like 'how much did I spend on Spotify in the last 3 months' or 'where did my money go'. " +
    "Turn any period in the question into fromDate and toDate, for example October is YYYY-10-01 to YYYY-10-31, in the year from the context block. " +
    "The result states the exact date range covered; check it matches the question and mention it in your answer. " +
    "When grouped, it returns a datasetId for render_chart: kind 'bar' for months or categories, " +
    "or kind 'pie' for how an expense total splits across categories.",
  input: z.object({
    type: TransactionTypeSchema.describe("Sum expenses or income. Never mix them."),
    groupBy: z.enum(["none", "month", "category"]).describe("How to break down the total."),
    ...ToolFilterFields,
  }),
  statusLabel: ({ type, search, categories }) => {
    const searched = cleanSearch(search);
    const subject = searched ? `“${searched}”` : categories?.length ? categories.join(", ") : type;
    return `Adding up ${subject}`;
  },
  run: async ({ type, groupBy, ...filters }, context) => {
    const result = await context.summary.sum({ ...toCriteria(filters), type }, groupBy);
    const datasetId =
      groupBy === "none"
        ? null
        : context.datasets.add({ kind: "grouped_sum", groupBy, type, groups: result.groups });
    return {
      total: formatDollars(result.total),
      count: result.count,
      dateRange: describeRange(result.range.from, result.range.to),
      datasetId,
      groups: result.groups.map((group) => ({
        [groupBy]: group.key,
        total: formatDollars(group.total),
        count: group.count,
        ...(groupBy === "category" &&
          result.total > 0 && { share: `${Math.round((group.total / result.total) * 100)}%` }),
      })),
    };
  },
});
