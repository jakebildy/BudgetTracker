// Server state for transactions. Every change refreshes the list, the summary and the month tabs.
import type { ListTransactionsQuery, TransactionInput } from "@budget/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTransaction,
  deleteTransaction,
  getMonths,
  getSummary,
  listTransactions,
  queryKeys,
  updateTransaction,
} from "../../api/transactions";

export function useTransactions(query: ListTransactionsQuery) {
  return useQuery({
    queryKey: queryKeys.transactions(query),
    queryFn: () => listTransactions(query),
    placeholderData: keepPreviousData,
  });
}

export function useSummary(month: string) {
  return useQuery({ queryKey: queryKeys.summary(month), queryFn: () => getSummary(month) });
}

export function useMonths() {
  return useQuery({ queryKey: queryKeys.months, queryFn: getMonths });
}

/** Call after anything changes transactions on the server, including approved proposals. */
export function useRefreshTransactionData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.allTransactions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.allSummaries }),
      queryClient.invalidateQueries({ queryKey: queryKeys.months }),
    ]);
}

export function useTransactionMutations() {
  const refresh = useRefreshTransactionData();
  return {
    create: useMutation({ mutationFn: createTransaction, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: TransactionInput }) => updateTransaction(id, input),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: deleteTransaction, onSuccess: refresh }),
  };
}
