// Dates travel as plain strings: "YYYY-MM-DD" for days and "YYYY-MM" for months.
// Plain strings avoid timezone shifts that Date objects introduce.
import { z } from "zod";

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine(isRealCalendarDate, "Not a real calendar date.");

export const MonthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the format YYYY-MM.");

export type IsoDate = z.infer<typeof IsoDateSchema>;
export type MonthKey = z.infer<typeof MonthKeySchema>;

export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function previousMonth(month: MonthKey): MonthKey {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, "0")}`;
}

export function firstDayOf(month: MonthKey): IsoDate {
  return `${month}-01`;
}

export function lastDayOf(month: MonthKey): IsoDate {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(days).padStart(2, "0")}`;
}

/** Months from `from` to `to`, inclusive, oldest first. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  let current = to;
  while (current >= from) {
    months.unshift(current);
    current = previousMonth(current);
  }
  return months;
}

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
