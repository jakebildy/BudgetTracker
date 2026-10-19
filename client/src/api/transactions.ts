import type {
  ListTransactionsQuery,
  MonthsResponse,
  SummaryResponse,
  Transaction,
  TransactionInput,
} from "@budget/shared";
import { request, requestWithoutBody } from "./http";

export const queryKeys = {
  transactions: (query: ListTransactionsQuery) => ["transactions", query] as const,
  allTransactions: ["transactions"] as const,
  summary: (month: string) => ["summary", month] as const,
  allSummaries: ["summary"] as const,
  months: ["months"] as const,
};

export function listTransactions(query: ListTransactionsQuery): Promise<Transaction[]> {
  return request("/api/transactions", { query });
}

export function createTransaction(input: TransactionInput): Promise<Transaction> {
  return request("/api/transactions", { method: "POST", body: input });
}

export function updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
  return request(`/api/transactions/${encodeURIComponent(id)}`, { method: "PUT", body: input });
}

export function deleteTransaction(id: string): Promise<void> {
  return requestWithoutBody(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getSummary(month: string): Promise<SummaryResponse> {
  return request("/api/summary", { query: { month } });
}

export function getMonths(): Promise<MonthsResponse> {
  return request("/api/months");
}
