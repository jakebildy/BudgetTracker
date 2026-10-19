import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { currentMonth } from "../lib/format";
import { installFakeApi, makeTransaction } from "../test/fakeApi";
import { renderWithQueryClient } from "../test/render";
import { HomePage } from "./HomePage";

const month = currentMonth();

function seed() {
  return [
    makeTransaction({ description: "Dinner out", date: `${month}-10` }),
    makeTransaction({
      description: "Paycheck",
      type: "income",
      category: "Salary",
      amount: 3200,
      date: `${month}-01`,
    }),
  ];
}

async function tableRows() {
  const table = await screen.findByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

describe("HomePage", () => {
  it("filters on the server by type", async () => {
    const { requests } = installFakeApi(seed());
    renderWithQueryClient(<HomePage />);
    await waitFor(async () => expect(await tableRows()).toHaveLength(2));

    const transactionsPanel = screen.getByRole("region", { name: "Transactions" });
    const typeFilter = within(transactionsPanel).getByRole("group", { name: "Type" });
    await userEvent.click(within(typeFilter).getByRole("button", { name: "Income" }));

    await waitFor(async () => expect(await tableRows()).toHaveLength(1));
    expect(screen.getByText("Paycheck")).toBeInTheDocument();
    expect(requests.some((request) => request.query.get("type") === "income")).toBe(true);
  });

  it("deletes a transaction and brings it back with Undo", async () => {
    const { requests } = installFakeApi(seed());
    renderWithQueryClient(<HomePage />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete Dinner out" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Deleted “Dinner out”");
    await waitFor(async () => expect(await tableRows()).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(async () => expect(await tableRows()).toHaveLength(2));
    const recreated = requests.find(
      (request) => request.method === "POST" && request.path === "/api/transactions",
    );
    expect(recreated?.body).toMatchObject({ description: "Dinner out", amount: 74.5 });
  });

  it("adds a transaction from a dialog opened next to the Transactions title", async () => {
    const { requests } = installFakeApi(seed());
    renderWithQueryClient(<HomePage />);

    const panel = screen.getByRole("region", { name: "Transactions" });
    await userEvent.click(within(panel).getByRole("button", { name: "Add transaction" }));

    const dialog = screen.getByRole("dialog", { name: "Add transaction" });
    await userEvent.type(within(dialog).getByLabelText("Description"), "Coffee");
    await userEvent.type(within(dialog).getByLabelText("Amount"), "4.5");
    await userEvent.selectOptions(within(dialog).getByLabelText("Category"), "Food");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add transaction" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = requests.find((request) => request.method === "POST");
    expect(post?.body).toMatchObject({ description: "Coffee", amount: 4.5, category: "Food" });
  });

  it("changes a category straight from its pill", async () => {
    const { requests } = installFakeApi(seed());
    renderWithQueryClient(<HomePage />);

    const pill = await screen.findByRole("combobox", { name: "Category for Dinner out" });
    await userEvent.selectOptions(pill, "Entertainment");

    await waitFor(() => expect(requests.some((request) => request.method === "PUT")).toBe(true));
    const put = requests.find((request) => request.method === "PUT");
    expect(put?.body).toMatchObject({ description: "Dinner out", amount: 74.5, category: "Entertainment" });
    await waitFor(() => expect(pill).toHaveValue("Entertainment"));
  });

  it("edits a transaction in a dialog", async () => {
    const { requests } = installFakeApi(seed());
    renderWithQueryClient(<HomePage />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Paycheck" }));

    const dialog = screen.getByRole("dialog", { name: "Edit transaction" });
    expect(within(dialog).getByLabelText("Description")).toHaveValue("Paycheck");
    expect(within(dialog).getByLabelText("Category")).toHaveValue("Salary");

    await userEvent.clear(within(dialog).getByLabelText("Amount"));
    await userEvent.type(within(dialog).getByLabelText("Amount"), "3300");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const put = requests.find((request) => request.method === "PUT");
    expect(put?.body).toMatchObject({ description: "Paycheck", amount: 3300 });
  });

  it("closes the edit dialog without saving on Cancel", async () => {
    const { requests } = installFakeApi(seed());
    renderWithQueryClient(<HomePage />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Paycheck" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(requests.some((request) => request.method === "PUT")).toBe(false);
  });
});
