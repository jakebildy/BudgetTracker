import { formatDollars, IsoDateSchema, sumDollars, TransactionTypeSchema } from "@budget/shared";
import { z } from "zod";
import { findRecurringCharges as detectRecurring } from "../../domain/recurring";
import { describeRange } from "./criteria";
import { defineTool } from "./defineTool";

export const findRecurringCharges = defineTool({
  name: "find_recurring_charges",
  description:
    "Finds charges that repeat on a steady schedule (weekly, every two weeks, monthly, quarterly or yearly), " +
    "such as subscriptions, rent and bills, in one call. Use it for questions about subscriptions, recurring bills, " +
    "fixed costs or upcoming charges. fixedAmount true means the same amount every time, which is usually a " +
    "subscription; false means a bill or habit whose amount varies. priceChange shows when the latest charge " +
    "differs from the one before. monthlyCost spreads each charge over a month, and the totals add them up.",
  input: z.object({
    type: TransactionTypeSchema.optional().describe(
      "expense (the default) for charges, income for repeating income.",
    ),
    fromDate: IsoDateSchema.optional().describe(
      "First date to look at, YYYY-MM-DD. Leave it out to use all history, which finds schedules best.",
    ),
    toDate: IsoDateSchema.optional().describe(
      "Last date to look at, YYYY-MM-DD. Leave it out to use all history.",
    ),
  }),
  statusLabel: () => "Looking for recurring charges",
  run: async ({ type = "expense", fromDate: from, toDate: to }, context) => {
    const transactions = await context.transactions.list({ type, ...(from && { from }), ...(to && { to }) });
    const charges = detectRecurring(transactions);
    const fixed = charges.filter((charge) => charge.fixedAmount);
    const dates = transactions.map((transaction) => transaction.date).sort();

    return {
      searched: describeRange(from ?? dates[0] ?? null, to ?? dates.at(-1) ?? null),
      charges: charges.map((charge) => ({
        description: charge.description,
        category: charge.category,
        cadence: charge.cadence,
        occurrences: charge.occurrences,
        firstDate: charge.firstDate,
        lastDate: charge.lastDate,
        latestAmount: formatDollars(charge.latestAmount),
        fixedAmount: charge.fixedAmount,
        priceChange: charge.priceChange
          ? `${formatDollars(charge.priceChange.from)} to ${formatDollars(charge.priceChange.to)}`
          : null,
        nextExpected: charge.nextExpected,
        monthlyCost: formatDollars(charge.monthlyCost),
      })),
      totals: {
        fixedAmountMonthly: formatDollars(sumDollars(fixed.map((charge) => charge.monthlyCost))),
        allRecurringMonthly: formatDollars(sumDollars(charges.map((charge) => charge.monthlyCost))),
      },
    };
  },
});
