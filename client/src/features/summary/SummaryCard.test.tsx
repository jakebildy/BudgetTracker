import type { SummaryResponse } from "@budget/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SummaryCard } from "./SummaryCard";

const october: SummaryResponse = {
  month: "2026-10",
  transactionCount: 9,
  totalIncome: 4050,
  totalExpenses: 2013.46,
  netBalance: 2036.54,
  expensesByCategory: [
    { category: "Housing", total: 1650 },
    { category: "Food", total: 216.87 },
    { category: "Health", total: 146.59 },
  ],
  previous: { month: "2026-09", totalIncome: 3200, totalExpenses: 2312.99, netBalance: 887.01 },
};

describe("SummaryCard", () => {
  it("splits expenses by category on the same scale as income", () => {
    render(<SummaryCard summary={october} />);

    const expenses = within(screen.getByRole("list", { name: "Expenses breakdown" })).getAllByRole(
      "listitem",
    );
    expect(expenses.map((segment) => segment.getAttribute("aria-label"))).toEqual([
      "Housing: $1,650.00, 82% of expenses",
      "Food: $216.87, 11% of expenses",
      "Health: $146.59, 7% of expenses",
    ]);
    expect(expenses[0]).toHaveStyle({ width: `${(1650 / 4050) * 100}%` });
  });

  it("shows the net balance as an amount, without a bar", () => {
    render(<SummaryCard summary={october} />);

    expect(screen.getByText("$2,036.54")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Net balance breakdown" })).not.toBeInTheDocument();
  });

  it("shows a negative net balance with a minus sign", () => {
    render(<SummaryCard summary={{ ...october, totalIncome: 1000, netBalance: -1013.46, previous: null }} />);
    expect(screen.getByText("−$1,013.46")).toBeInTheDocument();
  });

  it("shows what a segment is on hover", async () => {
    render(<SummaryCard summary={october} />);

    await userEvent.hover(screen.getByRole("listitem", { name: /^Food/ }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Food $216.87");
  });
});
