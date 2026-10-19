import { formatDollars, MonthKeySchema, monthsBetween } from "@budget/shared";
import { z } from "zod";
import { defineTool, ToolError } from "./defineTool";

const MAX_MONTHS = 24;

export const getSummary = defineTool({
  name: "get_summary",
  description:
    "Income, expenses, net balance and savings rate for each calendar month in a range. " +
    "Use it for questions about overall spending or saving, and for comparing months. " +
    "Savings rate is the share of income left after expenses. " +
    "Returns a datasetId you can pass to render_chart with kind 'column' to show income against expenses.",
  input: z.object({
    fromMonth: MonthKeySchema.describe("First month, YYYY-MM."),
    toMonth: MonthKeySchema.describe(
      "Last month, YYYY-MM. Use the same value as fromMonth for a single month.",
    ),
  }),
  statusLabel: ({ fromMonth, toMonth }) =>
    fromMonth === toMonth ? `Totalling ${fromMonth}` : `Totalling ${fromMonth} to ${toMonth}`,
  run: async ({ fromMonth, toMonth }, context) => {
    if (fromMonth > toMonth) throw new ToolError("fromMonth must not be after toMonth.");
    if (monthsBetween(fromMonth, toMonth).length > MAX_MONTHS) {
      throw new ToolError(`Ask for at most ${MAX_MONTHS} months at a time.`);
    }
    const rows = await context.summary.monthlyTotals(fromMonth, toMonth);
    return {
      datasetId: context.datasets.add({ kind: "monthly_totals", rows }),
      months: rows.map((row) => ({
        month: row.month,
        income: formatDollars(row.totalIncome),
        expenses: formatDollars(row.totalExpenses),
        net: formatDollars(row.netBalance),
        savingsRate: row.savingsRate === null ? "no income" : `${row.savingsRate}%`,
      })),
    };
  },
});
