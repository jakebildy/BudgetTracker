import type { Transaction } from "@budget/shared";
import { describe, expect, it } from "vitest";
import { groupTotals, savingsRate, totalsOf } from "../../src/domain/totals";

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    date: "2026-10-01",
    description: "Test",
    amount: 1,
    type: "expense",
    category: "Food",
    source: "manual",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("totalsOf", () => {
  it("adds in cents so decimal amounts don't drift", () => {
    const totals = totalsOf([
      transaction({ amount: 0.1 }),
      transaction({ amount: 0.2 }),
      transaction({ amount: 100, type: "income", category: "Salary" }),
    ]);
    expect(totals).toEqual({ totalIncome: 100, totalExpenses: 0.3, netBalance: 99.7 });
  });
});

describe("groupTotals", () => {
  it("orders categories by total, largest first", () => {
    const groups = groupTotals(
      [
        transaction({ category: "Food", amount: 10 }),
        transaction({ category: "Housing", amount: 50 }),
        transaction({ category: "Food", amount: 15 }),
      ],
      "category",
    );
    expect(groups).toEqual([
      { key: "Housing", total: 50, count: 1 },
      { key: "Food", total: 25, count: 2 },
    ]);
  });

  it("orders months oldest first", () => {
    const groups = groupTotals(
      [transaction({ date: "2026-10-03" }), transaction({ date: "2026-08-03" })],
      "month",
    );
    expect(groups.map((group) => group.key)).toEqual(["2026-08", "2026-10"]);
  });
});

describe("savingsRate", () => {
  it("is null without income", () => {
    expect(savingsRate({ totalIncome: 0, totalExpenses: 10, netBalance: -10 })).toBeNull();
  });

  it("rounds to a whole percentage", () => {
    expect(savingsRate({ totalIncome: 3, totalExpenses: 1, netBalance: 2 })).toBe(67);
  });
});
