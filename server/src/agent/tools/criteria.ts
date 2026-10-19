// Filter fields shared by the read tools, with descriptions the model reads.
import { CategorySchema, IsoDateSchema, type TransactionCriteria } from "@budget/shared";
import { z } from "zod";

/**
 * The date range is required (null means no limit). In strict tool use the model writes fields in a
 * fixed order and can't go back, required fields first. When the dates were optional and listed before
 * `search` and `categories`, the model often jumped straight to those and could no longer add dates,
 * so a question about October got an all-time total. Required, the dates are decided first, every call.
 */
export const ToolFilterFields = {
  fromDate: IsoDateSchema.nullable().describe(
    "First date to include, YYYY-MM-DD, such as YYYY-10-01 for October or the start of the last 3 months. " +
      "null only when the question covers all history.",
  ),
  toDate: IsoDateSchema.nullable().describe(
    "Last date to include, YYYY-MM-DD, such as YYYY-10-31 for October or today. " +
      "null only when the question covers all history.",
  ),
  categories: z.array(CategorySchema).optional().describe("Only these categories. Omit for all categories."),
  // No minimum length: an empty search is ignored rather than rejected, so it doesn't cost the model a turn.
  search: z
    .string()
    .optional()
    .describe("Case-insensitive text the description must contain, such as a merchant name like 'spotify'."),
  minAmount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Smallest amount to include, in dollars. Only set when the question mentions an amount."),
  // 0 can't be meant (every amount is above 0), so it's ignored rather than rejected, which
  // would cost the model a turn.
  maxAmount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Largest amount to include, in dollars. Only set when the question mentions an amount."),
};

/**
 * The search text with whitespace and stray quotes removed, or undefined if nothing is left.
 * Models sometimes fill an unused search with "" or "\"\"".
 */
export function cleanSearch(search: string | undefined): string | undefined {
  const cleaned = search
    ?.trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
  return cleaned ? cleaned : undefined;
}

type FilterInput = {
  fromDate?: string | null | undefined;
  toDate?: string | null | undefined;
  categories?: TransactionCriteria["categories"] | undefined;
  search?: string | undefined;
  minAmount?: number | undefined;
  maxAmount?: number | undefined;
};

/** Copies only the filters the model actually set. */
export function toCriteria(input: FilterInput): TransactionCriteria {
  const search = cleanSearch(input.search);
  return {
    ...(input.fromDate && { from: input.fromDate }),
    ...(input.toDate && { to: input.toDate }),
    ...(input.categories?.length && { categories: input.categories }),
    ...(search && { search }),
    ...(input.minAmount !== undefined && { minAmount: input.minAmount }),
    ...(input.maxAmount !== undefined && input.maxAmount > 0 && { maxAmount: input.maxAmount }),
  };
}

export function describeRange(from: string | null, to: string | null): string {
  if (from && to) return `${from} to ${to}`;
  if (from) return `from ${from}`;
  if (to) return `through ${to}`;
  return "all dates";
}
