import { describe, expect, it } from "vitest";
import { buildTestDependencies } from "../support/testApp";

describe("SummaryService", () => {
  it("returns a month's totals with the previous month for comparison", async () => {
    const { summary } = buildTestDependencies();
    const october = await summary.summary("2026-10");

    expect(october).toMatchObject({
      month: "2026-10",
      totalIncome: 4050,
      totalExpenses: 2013.46,
      netBalance: 2036.54,
      previous: { month: "2026-09", totalIncome: 3200, totalExpenses: 2312.99 },
    });
  });

  it("breaks expenses down by category, largest first", async () => {
    const { summary } = buildTestDependencies();
    const october = await summary.summary("2026-10");
    expect(october.expensesByCategory.slice(0, 2)).toEqual([
      { category: "Housing", total: 1650 },
      { category: "Food", total: 216.87 },
    ]);
  });

  it("has no previous month before the first month of data", async () => {
    const { summary } = buildTestDependencies();
    expect((await summary.summary("2026-07")).previous).toBeNull();
  });

  it("sums matching transactions and reports the date range it covered", async () => {
    const { summary } = buildTestDependencies();
    const spotify = await summary.sum(
      { type: "expense", search: "spotify", from: "2026-08-01", to: "2026-10-15" },
      "month",
    );

    expect(spotify.total).toBe(35.97);
    expect(spotify.count).toBe(3);
    expect(spotify.range).toEqual({ from: "2026-08-01", to: "2026-10-15" });
    expect(spotify.groups.map((group) => group.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("returns one row per month, including months with no transactions", async () => {
    const { summary } = buildTestDependencies();
    const rows = await summary.monthlyTotals("2026-06", "2026-07");
    expect(rows[0]).toMatchObject({ month: "2026-06", totalIncome: 0, savingsRate: null });
    expect(rows[1]).toMatchObject({ month: "2026-07", totalIncome: 3800 });
  });
});
