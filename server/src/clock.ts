import type { IsoDate } from "@budget/shared";

export interface Clock {
  now(): Date;
  /** Today's date in the server's local timezone. */
  today(): IsoDate;
}

export const systemClock: Clock = {
  now: () => new Date(),
  today: () => toLocalIsoDate(new Date()),
};

export function fixedClock(isoDateTime: string): Clock {
  const date = new Date(isoDateTime);
  return { now: () => new Date(date), today: () => toLocalIsoDate(date) };
}

function toLocalIsoDate(date: Date): IsoDate {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
