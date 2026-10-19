import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { installFakeApi } from "../../test/fakeApi";
import { renderWithQueryClient } from "../../test/render";
import { TransactionForm } from "./TransactionForm";

function renderForm() {
  const onSaved = vi.fn();
  renderWithQueryClient(
    <TransactionForm editing={null} defaultDate="2026-10-14" headingId="heading" onSaved={onSaved} />,
  );
  return { onSaved };
}

describe("TransactionForm", () => {
  it("explains each missing field instead of submitting", async () => {
    const { requests } = installFakeApi([]);
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(screen.getByText("Add a short description.")).toBeInTheDocument();
    expect(screen.getByText("Enter an amount, like 42.50.")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveAttribute("aria-invalid", "true");
    expect(
      requests.filter((request) => request.method === "POST" && request.path === "/api/transactions"),
    ).toEqual([]);
  });

  it("asks for a category when none is chosen", async () => {
    installFakeApi([]);
    renderForm();

    await userEvent.type(screen.getByLabelText("Description"), "Something");
    await userEvent.type(screen.getByLabelText("Amount"), "16.49");
    await userEvent.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(screen.getByText("Select a category.")).toBeInTheDocument();
  });

  it("rejects a zero amount", async () => {
    installFakeApi([]);
    renderForm();

    await userEvent.type(screen.getByLabelText("Amount"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(screen.getByText("Amount must be more than 0.")).toBeInTheDocument();
  });

  it("only offers categories for the chosen type", async () => {
    installFakeApi([]);
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Choose a category", "Salary", "Freelance", "Other"]);
  });

  it("sends a valid transaction to the API", async () => {
    const { requests } = installFakeApi([]);
    const { onSaved } = renderForm();

    await userEvent.type(screen.getByLabelText("Description"), "Groceries");
    await userEvent.type(screen.getByLabelText("Amount"), "42.5");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "Food");
    await userEvent.click(screen.getByRole("button", { name: "Add transaction" }));

    const post = requests.find(
      (request) => request.method === "POST" && request.path === "/api/transactions",
    );
    expect(post?.body).toEqual({
      type: "expense",
      description: "Groceries",
      amount: 42.5,
      date: "2026-10-14",
      category: "Food",
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
