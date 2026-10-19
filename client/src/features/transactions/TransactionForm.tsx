import {
  type Category,
  categoriesFor,
  isCategoryForType,
  type Transaction,
  TransactionInputSchema,
  type TransactionType,
} from "@budget/shared";
import { useId, useState } from "react";
import { ApiRequestError } from "../../api/http";
import { Field, fieldStyles } from "../../components/Field";
import { useTransactionMutations } from "./hooks";
import styles from "./TransactionForm.module.css";

type Draft = {
  type: TransactionType;
  description: string;
  amount: string;
  /** Null until the user picks a date, so the form follows the selected month. */
  date: string | null;
  category: Category | "";
};

const FORM_FIELDS = ["description", "amount", "date", "category"] as const;
type FormField = (typeof FORM_FIELDS)[number];
type FieldErrors = Partial<Record<FormField, string>>;

type Props = {
  /** The transaction being edited, or null to add a new one. */
  editing: Transaction | null;
  defaultDate: string;
  /** Id for the heading, so the panel or dialog around the form can be labelled by it. */
  headingId: string;
  onSaved: (transaction: Transaction) => void;
  /** Shows a Cancel button when given. */
  onCancel?: () => void;
};

const EMPTY_DRAFT: Draft = { type: "expense", description: "", amount: "", date: null, category: "" };

/** The add/edit form, shown in a dialog. */
export function TransactionForm({ editing, defaultDate, headingId, onSaved, onCancel }: Props) {
  const fieldId = useId();
  const [draft, setDraft] = useState<Draft>(() => (editing ? draftFrom(editing) : EMPTY_DRAFT));
  const [errors, setErrors] = useState<FieldErrors>({});
  const { create, update } = useTransactionMutations();
  const date = draft.date ?? defaultDate;
  const { type, category } = draft;

  function change(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function changeType(next: TransactionType) {
    const keepCategory = draft.category !== "" && isCategoryForType(draft.category, next);
    change({ type: next, category: keepCategory ? draft.category : "" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = TransactionInputSchema.safeParse({
      type,
      description: draft.description,
      amount: draft.amount.trim() === "" ? undefined : Number(draft.amount),
      date,
      category: category === "" ? undefined : category,
    });
    if (!parsed.success) {
      setErrors(firstErrorPerField(parsed.error.issues));
      return;
    }
    try {
      const saved = editing
        ? await update.mutateAsync({ id: editing.id, input: parsed.data })
        : await create.mutateAsync(parsed.data);
      setErrors({});
      setDraft(EMPTY_DRAFT);
      onSaved(saved);
    } catch (error) {
      setErrors(
        error instanceof ApiRequestError
          ? firstErrorPerField(
              Object.entries(error.fieldErrors).map(([field, message]) => ({ path: [field], message })),
            )
          : { description: "Couldn't save. Try again." },
      );
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <div className={styles.header}>
        <h2 id={headingId} className={styles.heading}>
          {editing ? "Edit transaction" : "Add transaction"}
        </h2>
        {onCancel && (
          <button type="button" className={styles.linkButton} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={fieldStyles.label}>Type</legend>
        <div className={styles.typeToggle}>
          {(["expense", "income"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={type === option}
              className={`${styles.typeButton} ${styles[option]}`}
              onClick={() => changeType(option)}
            >
              {option === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>
      </fieldset>

      <Field id={`${fieldId}-description`} label="Description" error={errors.description}>
        {(props) => (
          <input
            {...props}
            type="text"
            className={fieldStyles.control}
            placeholder="e.g. Groceries at Save-On"
            value={draft.description}
            onChange={(event) => change({ description: event.target.value })}
          />
        )}
      </Field>

      <div className={styles.twoColumns}>
        <Field id={`${fieldId}-amount`} label="Amount" error={errors.amount}>
          {(props) => (
            <div className={styles.amountBox}>
              <span aria-hidden="true" className={styles.currency}>
                $
              </span>
              <input
                {...props}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className={`${fieldStyles.control} ${styles.amountInput}`}
                value={draft.amount}
                onChange={(event) => change({ amount: event.target.value })}
              />
            </div>
          )}
        </Field>
        <Field id={`${fieldId}-date`} label="Date" error={errors.date}>
          {(props) => (
            <input
              {...props}
              type="date"
              className={fieldStyles.control}
              value={date}
              onChange={(event) => change({ date: event.target.value })}
            />
          )}
        </Field>
      </div>

      <Field id={`${fieldId}-category`} label="Category" error={errors.category}>
        {(props) => (
          <select
            {...props}
            className={fieldStyles.control}
            value={category}
            onChange={(event) => {
              change({ category: toCategory(event.target.value, type) });
              setErrors(({ category: _cleared, ...rest }) => rest);
            }}
          >
            <option value="">Choose a category</option>
            {categoriesFor(type).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        )}
      </Field>

      <button type="submit" className={styles.submit} disabled={saving}>
        {editing ? "Save changes" : "Add transaction"}
      </button>
    </form>
  );
}

function draftFrom(transaction: Transaction): Draft {
  return {
    type: transaction.type,
    description: transaction.description,
    amount: transaction.amount.toFixed(2),
    date: transaction.date,
    category: transaction.category,
  };
}

function toCategory(value: string, type: TransactionType): Category | "" {
  return categoriesFor(type).find((category) => category === value) ?? "";
}

function firstErrorPerField(issues: readonly { path: PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = FORM_FIELDS.find((name) => name === issue.path[0]);
    if (field) errors[field] ??= issue.message;
  }
  return errors;
}
