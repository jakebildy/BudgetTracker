// The fixed category lists. Each transaction type has its own set, and a
// category is only valid for the type it belongs to.

export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "Food",
  "Housing",
  "Utilities",
  "Transport",
  "Entertainment",
  "Health",
  "Shopping",
  "Other",
] as const;

export const INCOME_CATEGORIES = ["Salary", "Freelance", "Other"] as const;

export const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES.filter((category) => category !== "Other"),
] as const;

export type Category = (typeof ALL_CATEGORIES)[number];

export function categoriesFor(type: TransactionType): readonly Category[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function isCategoryForType(category: string, type: TransactionType): boolean {
  return categoriesFor(type).some((allowed) => allowed === category);
}
