import { formatDollars, type TransactionType } from "@budget/shared";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthIndex(isoMonthOrDate: string): number {
  return Number(isoMonthOrDate.slice(5, 7)) - 1;
}

/** "2026-10" → "October 2026" */
export function monthTitle(month: string): string {
  return `${MONTH_NAMES[monthIndex(month)]} ${month.slice(0, 4)}`;
}

/** "2026-10" → "Oct" */
export function monthShort(month: string): string {
  return (MONTH_NAMES[monthIndex(month)] ?? "").slice(0, 3);
}

/** "2026-10-03" → "Oct 3" */
export function shortDate(date: string): string {
  return `${monthShort(date)} ${Number(date.slice(8, 10))}`;
}

export const formatMoney = formatDollars;

/** Signed amount for the table: "+$850.00" for income, "−$61.20" for expenses. */
export function signedAmount(amount: number, type: TransactionType): string {
  return `${type === "income" ? "+" : "−"}${formatDollars(amount)}`;
}

/** Net balance with a true minus sign, matching the design. */
export function formatBalance(amount: number): string {
  return amount < 0 ? `−${formatDollars(Math.abs(amount))}` : formatDollars(amount);
}

export function currentMonth(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function todayIso(today = new Date()): string {
  return `${currentMonth(today)}-${String(today.getDate()).padStart(2, "0")}`;
}
