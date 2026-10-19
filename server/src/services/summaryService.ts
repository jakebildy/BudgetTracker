// Totals and aggregations. Used by GET /api/summary and by the agent's read tools.
import {
  firstDayOf,
  lastDayOf,
  type MonthKey,
  monthsBetween,
  previousMonth,
  type SummaryResponse,
  type SummaryTotals,
  sumDollars,
  type TransactionCriteria,
} from "@budget/shared";
import { type GroupBy, type GroupTotal, groupTotals, savingsRate, totalsOf } from "../domain/totals";
import type { TransactionService } from "./transactionService";

export type MonthlyTotals = SummaryTotals & { month: MonthKey; savingsRate: number | null };

export type SumResult = {
  total: number;
  count: number;
  /** The date range actually covered, so answers can state it. */
  range: { from: string | null; to: string | null };
  groups: GroupTotal[];
};

export class SummaryService {
  constructor(private readonly transactions: TransactionService) {}

  async summary(month?: MonthKey): Promise<SummaryResponse> {
    const inScope = await this.transactions.list(month ? { month } : {});
    const totals = totalsOf(inScope);
    const expensesByCategory = groupTotals(
      inScope.filter((transaction) => transaction.type === "expense"),
      "category",
    ).map((group) => ({ category: group.key, total: group.total }));
    if (!month) {
      return { month: null, transactionCount: inScope.length, ...totals, expensesByCategory, previous: null };
    }
    const prior = previousMonth(month);
    const priorTransactions = await this.transactions.list({ month: prior });
    return {
      month,
      transactionCount: inScope.length,
      ...totals,
      expensesByCategory,
      previous: priorTransactions.length > 0 ? { month: prior, ...totalsOf(priorTransactions) } : null,
    };
  }

  async monthlyTotals(from: MonthKey, to: MonthKey): Promise<MonthlyTotals[]> {
    const inRange = await this.transactions.list({ from: firstDayOf(from), to: lastDayOf(to) });
    return monthsBetween(from, to).map((month) => {
      const totals = totalsOf(inRange.filter((transaction) => transaction.date.startsWith(month)));
      return { month, ...totals, savingsRate: savingsRate(totals) };
    });
  }

  async sum(criteria: TransactionCriteria, groupBy: GroupBy | "none"): Promise<SumResult> {
    const matches = await this.transactions.list(criteria);
    const dates = matches.map((transaction) => transaction.date).sort();
    return {
      total: sumDollars(matches.map((transaction) => transaction.amount)),
      count: matches.length,
      range: {
        from: criteria.from ?? (criteria.month ? firstDayOf(criteria.month) : (dates[0] ?? null)),
        to: criteria.to ?? (criteria.month ? lastDayOf(criteria.month) : (dates.at(-1) ?? null)),
      },
      groups: groupBy === "none" ? [] : groupTotals(matches, groupBy),
    };
  }
}
