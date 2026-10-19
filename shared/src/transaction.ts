// The transaction contract shared by the API, the form, CSV import and the agent.
import { z } from "zod";
import { ALL_CATEGORIES, isCategoryForType, TRANSACTION_TYPES } from "./categories";
import { IsoDateSchema } from "./dates";
import { hasAtMostTwoDecimals } from "./money";

export const TransactionTypeSchema = z.enum(TRANSACTION_TYPES);
export const CategorySchema = z.enum(ALL_CATEGORIES, { error: "Select a category." });
export const TransactionSourceSchema = z.enum(["manual", "agent"]);

export const AmountSchema = z
  .number({ error: "Enter an amount, like 42.50." })
  .positive("Amount must be more than 0.")
  .max(1_000_000_000, "That amount is too large.")
  .refine(hasAtMostTwoDecimals, "Use at most two decimal places.");

export const DescriptionSchema = z
  .string()
  .trim()
  .min(1, "Add a short description.")
  .max(120, "Keep the description under 120 characters.");

/** What a person (or the agent) provides when creating or replacing a transaction. */
export const TransactionInputSchema = z
  .object({
    date: IsoDateSchema,
    description: DescriptionSchema,
    amount: AmountSchema,
    type: TransactionTypeSchema,
    category: CategorySchema,
  })
  .refine((input) => isCategoryForType(input.category, input.type), {
    path: ["category"],
    message: "That category doesn't match the transaction type.",
  });

export const TransactionSchema = z.object({
  id: z.string(),
  date: IsoDateSchema,
  description: z.string(),
  amount: z.number(),
  type: TransactionTypeSchema,
  category: CategorySchema,
  source: TransactionSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TransactionInput = z.infer<typeof TransactionInputSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;
