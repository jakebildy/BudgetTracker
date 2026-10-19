import type { Category, Transaction } from "@budget/shared";
import { PlusIcon } from "../../components/icons";
import { monthTitle } from "../../lib/format";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useTransactionMutations, useTransactions } from "./hooks";
import { type Filters, TransactionFilters } from "./TransactionFilters";
import styles from "./TransactionsPanel.module.css";
import { TransactionTable } from "./TransactionTable";

type Props = {
  month: string;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  editingId: string | null;
  onAdd: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  lastDeleted: Transaction | null;
  onUndoDelete: () => void;
};

export function TransactionsPanel(props: Props) {
  const { month, filters, onFiltersChange, editingId, onAdd, onEdit, onDelete, lastDeleted, onUndoDelete } =
    props;
  const search = useDebouncedValue(filters.search.trim(), 300);
  const {
    data: transactions = [],
    isPending,
    isError,
  } = useTransactions({
    month,
    ...(filters.type !== "all" && { type: filters.type }),
    ...(filters.category !== "all" && { category: filters.category }),
    ...(search && { search }),
  });
  const { update } = useTransactionMutations();

  function changeCategory(transaction: Transaction, category: Category) {
    const { date, description, amount, type } = transaction;
    update.mutate({ id: transaction.id, input: { date, description, amount, type, category } });
  }

  const pendingCategory =
    update.isPending && update.variables
      ? { id: update.variables.id, category: update.variables.input.category }
      : null;

  return (
    <section aria-labelledby="transactions-heading" className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.headingRow}>
          <h2 id="transactions-heading" className={styles.heading}>
            Transactions
          </h2>
          <button type="button" className={styles.addButton} onClick={onAdd}>
            <PlusIcon />
            Add transaction
          </button>
        </div>
        <TransactionFilters filters={filters} onChange={onFiltersChange} />
      </div>

      {lastDeleted && (
        <div role="status" className={styles.toast}>
          <span>Deleted “{lastDeleted.description}”</span>
          <button type="button" className={styles.undo} onClick={onUndoDelete}>
            Undo
          </button>
        </div>
      )}

      <TransactionTable
        caption={`Transactions for ${monthTitle(month)}, newest first`}
        transactions={transactions}
        editingId={editingId}
        onEdit={onEdit}
        onDelete={onDelete}
        onCategoryChange={changeCategory}
        pendingCategory={pendingCategory}
      />

      {update.isError && (
        <p role="alert" className={styles.error}>
          Couldn't change the category. Try again.
        </p>
      )}

      {isError && <p className={styles.empty}>Couldn't load transactions. Is the server running?</p>}
      {!isPending && !isError && transactions.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No matching transactions</p>
          <p className={styles.emptyHint}>Try a different search, clear the filters or pick another month.</p>
        </div>
      )}
    </section>
  );
}
