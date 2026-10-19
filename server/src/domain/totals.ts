// Pure arithmetic over transactions. All sums go through cents (see shared/money).
import { monthOf, type SummaryTotals, subtractDollars, sumDollars, type Transaction } from "@budget/shared";

export function totalsOf(transactions: readonly Transaction[]): SummaryTotals {
  const totalIncome = sumDollars(transactions.filter((t) => t.type === "income").map((t) => t.amount));
  const totalExpenses = sumDollars(transactions.filter((t) => t.type === "expense").map((t) => t.amount));
  return { totalIncome, totalExpenses, netBalance: subtractDollars(totalIncome, totalExpenses) };
}

export type GroupBy = "month" | "category";

export type GroupTotal = { key: string; total: number; count: number };

/** Sums amounts per month or per category, largest total first for categories and oldest first for months. */
export function groupTotals(
  transactions: readonly Pick<Transaction, "date" | "category" | "amount">[],
  groupBy: GroupBy,
): GroupTotal[] {
  const amountsByKey = new Map<string, number[]>();
  for (const transaction of transactions) {
    const key = groupBy === "month" ? monthOf(transaction.date) : transaction.category;
    amountsByKey.set(key, [...(amountsByKey.get(key) ?? []), transaction.amount]);
  }
  const groups = [...amountsByKey].map(([key, amounts]) => ({
    key,
    total: sumDollars(amounts),
    count: amounts.length,
  }));
  return groupBy === "month"
    ? groups.sort((a, b) => a.key.localeCompare(b.key))
    : groups.sort((a, b) => b.total - a.total);
}

/** Share of income left after expenses, as a whole percentage. Null when there was no income. */
export function savingsRate(totals: SummaryTotals): number | null {
  if (totals.totalIncome <= 0) return null;
  return Math.round((totals.netBalance / totals.totalIncome) * 100);
}
