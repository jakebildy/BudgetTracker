import { describe, expect, it } from "vitest";
import { IsoDateSchema, lastDayOf, monthsBetween, previousMonth } from "./dates";
import { formatDollars, hasAtMostTwoDecimals, sumDollars } from "./money";

describe("dates", () => {
  it("rejects dates that don't exist", () => {
    expect(IsoDateSchema.safeParse("2026-02-29").success).toBe(false);
    expect(IsoDateSchema.safeParse("2028-02-29").success).toBe(true);
  });

  it("steps back across a year boundary", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("knows the last day of each month", () => {
    expect(lastDayOf("2026-02")).toBe("2026-02-28");
    expect(lastDayOf("2026-10")).toBe("2026-10-31");
  });

  it("lists months in a range, inclusive", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("money", () => {
  it("sums without floating-point drift", () => {
    expect(sumDollars([0.1, 0.2])).toBe(0.3);
  });

  it("allows at most two decimals", () => {
    expect(hasAtMostTwoDecimals(12.34)).toBe(true);
    expect(hasAtMostTwoDecimals(12.345)).toBe(false);
  });

  it("formats dollars", () => {
    expect(formatDollars(1234.5)).toBe("$1,234.50");
    expect(formatDollars(-12)).toBe("-$12.00");
  });
});
