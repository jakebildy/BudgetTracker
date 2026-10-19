import { monthOf, type Transaction, type TransactionCriteria } from "@budget/shared";

export function matchesCriteria(transaction: Transaction, criteria: TransactionCriteria): boolean {
  const { from, to, month, type, categories, search, minAmount, maxAmount } = criteria;
  if (from && transaction.date < from) return false;
  if (to && transaction.date > to) return false;
  if (month && monthOf(transaction.date) !== month) return false;
  if (type && transaction.type !== type) return false;
  if (categories && categories.length > 0 && !categories.includes(transaction.category)) return false;
  if (search && !transaction.description.toLowerCase().includes(search.toLowerCase())) return false;
  if (minAmount !== undefined && transaction.amount < minAmount) return false;
  if (maxAmount !== undefined && transaction.amount > maxAmount) return false;
  return true;
}

/** Newest first; ties broken by creation time so new entries appear on top. */
export function newestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}
