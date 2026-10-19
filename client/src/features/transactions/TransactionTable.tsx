import type { Category, Transaction, TransactionSource } from "@budget/shared";
import { EditIcon, TrashIcon } from "../../components/icons";
import { shortDate, signedAmount } from "../../lib/format";
import { CategoryPicker } from "./CategoryPicker";
import styles from "./TransactionTable.module.css";

const SOURCE_LABELS: Record<TransactionSource, string> = {
  manual: "Added by hand",
  agent: "Changed by Ask AI",
};

type Props = {
  caption: string;
  transactions: readonly Transaction[];
  editingId: string | null;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onCategoryChange: (transaction: Transaction, category: Category) => void;
  /** A category change still being saved, shown in its row until the list refreshes. */
  pendingCategory: { id: string; category: Category } | null;
};

export function TransactionTable(props: Props) {
  const { caption, transactions, editingId, onEdit, onDelete, onCategoryChange, pendingCategory } = props;
  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Category</th>
            <th scope="col" className={styles.amountHeader}>
              Amount
            </th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id} className={transaction.id === editingId ? styles.editing : undefined}>
              <td className={styles.date}>{shortDate(transaction.date)}</td>
              <td className={styles.description}>
                <span className={styles.descriptionText}>{transaction.description}</span>
                <span className={styles.source}>{SOURCE_LABELS[transaction.source]}</span>
              </td>
              <td>
                <CategoryPicker
                  transaction={transaction}
                  value={
                    pendingCategory?.id === transaction.id ? pendingCategory.category : transaction.category
                  }
                  disabled={pendingCategory?.id === transaction.id}
                  onChange={(category) => onCategoryChange(transaction, category)}
                />
              </td>
              <td className={transaction.type === "income" ? styles.income : styles.expense}>
                <span className="visually-hidden">
                  {transaction.type === "income" ? "Income" : "Expense"}:{" "}
                </span>
                {signedAmount(transaction.amount, transaction.type)}
              </td>
              <td className={styles.actions}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Edit ${transaction.description}`}
                  onClick={() => onEdit(transaction)}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Delete ${transaction.description}`}
                  onClick={() => onDelete(transaction)}
                >
                  <TrashIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
