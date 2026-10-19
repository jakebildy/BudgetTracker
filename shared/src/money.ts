// Amounts are dollars with at most two decimals. Any arithmetic happens in
// integer cents so totals never pick up floating-point drift.

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumDollars(amounts: readonly number[]): number {
  const totalCents = amounts.reduce((total, amount) => total + toCents(amount), 0);
  return fromCents(totalCents);
}

export function subtractDollars(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

export function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

const dollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats 1234.5 as "$1,234.50" and -12 as "-$12.00". */
export function formatDollars(amount: number): string {
  return dollarFormatter.format(amount);
}
