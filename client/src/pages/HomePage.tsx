import type { Transaction } from "@budget/shared";
import { useState } from "react";
import { AskAiPanel } from "../features/insights/AskAiPanel";
import { MonthSwitcher } from "../features/summary/MonthSwitcher";
import { SummaryCard } from "../features/summary/SummaryCard";
import { useMonths, useSummary, useTransactionMutations } from "../features/transactions/hooks";
import { TransactionDialog } from "../features/transactions/TransactionDialog";
import { type Filters, NO_FILTERS } from "../features/transactions/TransactionFilters";
import { TransactionsPanel } from "../features/transactions/TransactionsPanel";
import { currentMonth, monthTitle, todayIso } from "../lib/format";
import styles from "./HomePage.module.css";

type DialogState = { mode: "add" } | { mode: "edit"; transaction: Transaction } | null;

export function HomePage() {
  const thisMonth = currentMonth();
  const [month, setMonth] = useState(thisMonth);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [dialog, setDialog] = useState<DialogState>(null);
  const editing = dialog?.mode === "edit" ? dialog.transaction : null;
  const [lastDeleted, setLastDeleted] = useState<Transaction | null>(null);

  const { data: monthsData } = useMonths();
  const { data: summary } = useSummary(month);
  const { create, remove } = useTransactionMutations();

  const allMonths = [...new Set([...(monthsData?.months ?? []), thisMonth, month])].sort();

  function selectMonth(next: string) {
    setMonth(next);
    setLastDeleted(null);
  }

  function handleDelete(transaction: Transaction) {
    remove.mutate(transaction.id, {
      onSuccess: () => {
        setLastDeleted(transaction);
        if (editing?.id === transaction.id) setDialog(null);
      },
    });
  }

  function undoDelete() {
    if (!lastDeleted) return;
    const { date, description, amount, type, category } = lastDeleted;
    create.mutate({ date, description, amount, type, category });
    setLastDeleted(null);
  }

  function handleSaved(saved: Transaction) {
    setDialog(null);
    setLastDeleted(null);
    selectMonth(saved.date.slice(0, 7));
  }

  const count = summary?.transactionCount ?? 0;

  return (
    <>
      <main className={styles.main}>
        <div className={styles.column}>
          <header className={styles.header}>
            <div className={styles.titleBlock}>
              <p className={styles.eyebrow}>
                {count} {count === 1 ? "transaction" : "transactions"} this month
              </p>
              <h1 className={styles.title}>{monthTitle(month)}</h1>
            </div>
            <MonthSwitcher months={allMonths} value={month} onChange={selectMonth} />
          </header>

          <SummaryCard summary={summary} />

          <TransactionsPanel
            month={month}
            filters={filters}
            onFiltersChange={setFilters}
            editingId={editing?.id ?? null}
            onAdd={() => setDialog({ mode: "add" })}
            onEdit={(transaction) => setDialog({ mode: "edit", transaction })}
            onDelete={handleDelete}
            lastDeleted={lastDeleted}
            onUndoDelete={undoDelete}
          />
        </div>
      </main>
      {dialog && (
        <TransactionDialog
          key={editing?.id ?? "add"}
          transaction={editing}
          defaultDate={month === thisMonth ? todayIso() : `${month}-15`}
          onSaved={handleSaved}
          onClose={() => setDialog(null)}
        />
      )}
      <AskAiPanel month={month} />
    </>
  );
}
