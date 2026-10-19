// Finds charges that repeat on a steady schedule, such as subscriptions, rent and bills.
// Pure arithmetic over transactions, so the agent never has to spot patterns itself.
import type { Transaction } from "@budget/shared";

export type Cadence = "weekly" | "every two weeks" | "monthly" | "quarterly" | "yearly";

export type RecurringCharge = {
  description: string;
  category: string;
  cadence: Cadence;
  occurrences: number;
  firstDate: string;
  lastDate: string;
  latestAmount: number;
  /** Same amount every time (within 1%): usually a subscription. Otherwise a bill or a habit. */
  fixedAmount: boolean;
  /** Set when the latest charge differs from the one before it. */
  priceChange: { from: number; to: number } | null;
  nextExpected: string;
  /** The latest amount spread over a month, so different cadences can be added up. */
  monthlyCost: number;
};

/** `step` is how to find the next date: a number of days, or of calendar months (so the 12th stays the 12th). */
const CADENCES: {
  cadence: Cadence;
  minDays: number;
  maxDays: number;
  perMonth: number;
  step: { days: number } | { months: number };
}[] = [
  { cadence: "weekly", minDays: 5, maxDays: 9, perMonth: 52 / 12, step: { days: 7 } },
  { cadence: "every two weeks", minDays: 12, maxDays: 16, perMonth: 26 / 12, step: { days: 14 } },
  { cadence: "monthly", minDays: 26, maxDays: 35, perMonth: 1, step: { months: 1 } },
  { cadence: "quarterly", minDays: 84, maxDays: 98, perMonth: 1 / 3, step: { months: 3 } },
  { cadence: "yearly", minDays: 350, maxDays: 380, perMonth: 1 / 12, step: { months: 12 } },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function findRecurringCharges(
  transactions: readonly Transaction[],
  minOccurrences = 3,
): RecurringCharge[] {
  const byMerchant = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = `${transaction.type}|${merchantKey(transaction.description)}`;
    byMerchant.set(key, [...(byMerchant.get(key) ?? []), transaction]);
  }

  const charges: RecurringCharge[] = [];
  for (const group of byMerchant.values()) {
    if (group.length < minOccurrences) continue;
    const charge = describeSchedule([...group].sort((a, b) => a.date.localeCompare(b.date)));
    if (charge) charges.push(charge);
  }
  return charges.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

/**
 * "Client invoice #011", "UBER *TRIP 4471" and "Save-On Foods #1234" become
 * "client invoice", "uber trip" and "save-on foods", so repeats line up.
 */
export function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/#\s*\d+/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[*.,:;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function describeSchedule(sorted: Transaction[]): RecurringCharge | null {
  const gaps = sorted
    .slice(1)
    .map((transaction, index) => daysBetween(sorted[index]?.date ?? "", transaction.date));
  const typicalGap = median(gaps);
  const match = CADENCES.find(({ minDays, maxDays }) => typicalGap >= minDays && typicalGap <= maxDays);
  // Most gaps must fit the cadence, or it's just a place you go often, not a schedule.
  if (
    !match ||
    gaps.filter((gap) => gap >= match.minDays && gap <= match.maxDays).length < gaps.length * 0.75
  ) {
    return null;
  }

  const latest = sorted.at(-1);
  const previous = sorted.at(-2);
  if (!latest || !previous) return null;
  const amounts = sorted.map((transaction) => transaction.amount);
  const lowest = Math.min(...amounts);
  const highest = Math.max(...amounts);

  return {
    description: latest.description,
    category: latest.category,
    cadence: match.cadence,
    occurrences: sorted.length,
    firstDate: sorted[0]?.date ?? latest.date,
    lastDate: latest.date,
    latestAmount: latest.amount,
    fixedAmount: highest - lowest <= highest * 0.01,
    priceChange: latest.amount !== previous.amount ? { from: previous.amount, to: latest.amount } : null,
    nextExpected:
      "days" in match.step
        ? addDays(latest.date, match.step.days)
        : addMonths(latest.date, match.step.months),
    monthlyCost: Math.round(latest.amount * match.perMonth * 100) / 100,
  };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Same day of the month, moved back to the last day when the target month is shorter. */
function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}
