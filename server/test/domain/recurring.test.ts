import { describe, expect, it } from "vitest";
import { findRecurringCharges, merchantKey } from "../../src/domain/recurring";
import { seedTransactions } from "../support/testApp";

const expenses = () => seedTransactions().filter((transaction) => transaction.type === "expense");

describe("findRecurringCharges", () => {
  it("finds fixed monthly charges like subscriptions and rent", () => {
    const charges = findRecurringCharges(expenses());
    const spotify = charges.find((charge) => charge.description === "Spotify");

    expect(spotify).toMatchObject({
      cadence: "monthly",
      occurrences: 4,
      latestAmount: 11.99,
      fixedAmount: true,
      priceChange: null,
      nextExpected: "2026-11-12",
      monthlyCost: 11.99,
    });
    expect(charges[0]).toMatchObject({ description: "Rent", monthlyCost: 1650 });
  });

  it("marks bills whose amount varies, and reports the latest price change", () => {
    const hydro = findRecurringCharges(expenses()).find((charge) => charge.description === "BC Hydro");
    expect(hydro).toMatchObject({ fixedAmount: false, priceChange: { from: 57.35, to: 61.2 } });
  });

  it("ignores things that happened only once or twice", () => {
    const names = findRecurringCharges(expenses()).map((charge) => charge.description);
    expect(names).not.toContain("Dinner out");
    expect(names).not.toContain("Pharmacy");
  });

  it("ignores repeats that don't follow a schedule", () => {
    const base = expenses()[0]!;
    const irregular = ["2026-01-02", "2026-01-05", "2026-02-20", "2026-02-21"].map((date, index) => ({
      ...base,
      id: `x${index}`,
      date,
      description: "Corner store",
    }));
    expect(findRecurringCharges(irregular)).toEqual([]);
  });
});

describe("merchantKey", () => {
  it("drops reference numbers so repeats line up", () => {
    expect(merchantKey("Client invoice #011")).toBe("client invoice");
    expect(merchantKey("UBER *TRIP 4471")).toBe("uber trip");
    expect(merchantKey("Save-On Foods #1234")).toBe("save-on foods");
  });
});
