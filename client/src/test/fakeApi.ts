// A tiny in-memory stand-in for the server, installed as the global fetch in tests.
import type { Transaction, TransactionInput } from "@budget/shared";
import { vi } from "vitest";

export type RecordedRequest = { method: string; path: string; query: URLSearchParams; body: unknown };

export function installFakeApi(initial: Transaction[]) {
  let transactions = [...initial];
  const requests: RecordedRequest[] = [];

  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, "http://localhost");
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    requests.push({ method, path: url.pathname, query: url.searchParams, body });

    if (url.pathname === "/api/transactions" && method === "GET") {
      const type = url.searchParams.get("type");
      const search = url.searchParams.get("search")?.toLowerCase();
      const month = url.searchParams.get("month");
      return json(
        transactions.filter(
          (t) =>
            (!type || t.type === type) &&
            (!month || t.date.startsWith(month)) &&
            (!search || t.description.toLowerCase().includes(search)),
        ),
      );
    }
    if (url.pathname === "/api/transactions" && method === "POST") {
      const created = makeTransaction(body as TransactionInput);
      transactions = [created, ...transactions];
      return json(created, 201);
    }
    if (url.pathname.startsWith("/api/transactions/") && method === "PUT") {
      const id = url.pathname.split("/").at(-1);
      const existing = transactions.find((t) => t.id === id);
      if (!existing) return json({ error: { code: "not_found", message: "Not found" } }, 404);
      const updated = { ...existing, ...(body as TransactionInput) };
      transactions = transactions.map((t) => (t.id === id ? updated : t));
      return json(updated);
    }
    if (url.pathname.startsWith("/api/transactions/") && method === "DELETE") {
      const id = url.pathname.split("/").at(-1);
      transactions = transactions.filter((t) => t.id !== id);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/api/summary") {
      return json({
        month: url.searchParams.get("month"),
        transactionCount: transactions.length,
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        expensesByCategory: [],
        previous: null,
      });
    }
    if (url.pathname === "/api/months") return json({ months: [] });
    return json({ error: { code: "not_found", message: "Not in fake API" } }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { requests };
}

let nextId = 1;

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const id = `t${nextId++}`;
  return {
    id,
    date: "2026-10-10",
    description: "Dinner out",
    amount: 74.5,
    type: "expense",
    category: "Food",
    source: "manual",
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
