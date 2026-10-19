import type { Transaction } from "@budget/shared";
import { useEffect, useId, useRef } from "react";
import styles from "./TransactionDialog.module.css";
import { TransactionForm } from "./TransactionForm";

type Props = {
  /** The transaction to edit, or null to add a new one. */
  transaction: Transaction | null;
  /** Used when adding: today in the current month, otherwise the middle of the selected month. */
  defaultDate: string;
  onSaved: (transaction: Transaction) => void;
  onClose: () => void;
};

/**
 * Adds or edits a transaction in a modal dialog. The native <dialog> traps focus,
 * closes on Escape, and returns focus to the button that opened it when it closes.
 */
export function TransactionDialog({ transaction, defaultDate, onSaved, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users close it with Escape (onCancel); the click handler only adds closing by clicking the backdrop.
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.body}>
        <TransactionForm
          editing={transaction}
          defaultDate={transaction?.date ?? defaultDate}
          headingId={headingId}
          onSaved={onSaved}
          onCancel={onClose}
        />
      </div>
    </dialog>
  );
}
