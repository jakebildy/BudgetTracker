import { z } from "zod";
import { MonthKeySchema } from "./dates";

export type SummaryTotals = {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
};

/**
 * GET /api/summary. Total income, total expenses and net balance, plus expenses broken down by category
 * (largest first) and the previous month's totals when a month is given.
 */
export type SummaryResponse = SummaryTotals & {
  month: string | null;
  transactionCount: number;
  expensesByCategory: { category: string; total: number }[];
  previous: (SummaryTotals & { month: string }) | null;
};

export const SummaryQuerySchema = z.object({
  month: MonthKeySchema.optional(),
});

/** GET /api/months: months that have at least one transaction, oldest first. */
export type MonthsResponse = { months: string[] };
