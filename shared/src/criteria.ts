// One way to describe "which transactions": used by the REST filters, the
// agent's tools and CSV duplicate detection.
import { z } from "zod";
import { ALL_CATEGORIES } from "./categories";
import { IsoDateSchema, MonthKeySchema } from "./dates";
import { CategorySchema, TransactionTypeSchema } from "./transaction";

export const TransactionCriteriaSchema = z.object({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  month: MonthKeySchema.optional(),
  type: TransactionTypeSchema.optional(),
  categories: z.array(CategorySchema).optional(),
  search: z.string().trim().min(1).optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
});

export type TransactionCriteria = z.infer<typeof TransactionCriteriaSchema>;

/** A category typed by hand, as in `?category=food`, matched to its proper name in any case. */
const CategoryParamSchema = z.preprocess(
  (value) =>
    typeof value === "string"
      ? (ALL_CATEGORIES.find((category) => category.toLowerCase() === value.trim().toLowerCase()) ?? value)
      : value,
  CategorySchema,
);

/** Query params for GET /api/transactions: `type`, `category` and `search`, plus `month`. */
export const ListTransactionsQuerySchema = z.object({
  type: TransactionTypeSchema.optional(),
  category: CategoryParamSchema.optional(),
  search: z.string().trim().min(1).optional(),
  month: MonthKeySchema.optional(),
});

export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;

export function criteriaFromQuery(query: ListTransactionsQuery): TransactionCriteria {
  return {
    ...(query.type && { type: query.type }),
    ...(query.category && { categories: [query.category] }),
    ...(query.search && { search: query.search }),
    ...(query.month && { month: query.month }),
  };
}
