import type { ProposalOperation, Transaction, TransactionInput } from "@budget/shared";
import { formatMoney, shortDate } from "../../lib/format";
import type { ProposalState } from "./conversation";
import styles from "./ProposalCard.module.css";

type Props = {
  proposal: ProposalState;
  onApprove: () => void;
  onReject: () => void;
};

/** Long proposals list the first few rows, then a count. */
const MAX_LISTED = 6;

const STATUS_TEXT = {
  approved: "Approved and applied.",
  rejected: "Rejected. Nothing changed.",
  expired: "This proposal expired. Ask again for a fresh one.",
} as const;

/** Shows exactly what the agent wants to change, with Approve and Reject. */
export function ProposalCard({ proposal, onApprove, onReject }: Props) {
  return (
    <section aria-label={`Proposed change: ${proposal.summary}`} className={styles.card}>
      <p className={styles.eyebrow}>Proposed change</p>
      <p className={styles.summary}>{proposal.summary}</p>
      <ul className={styles.operations}>
        {withKeys(proposal.operations.slice(0, MAX_LISTED)).map(({ key, operation }) => (
          <li key={key}>
            <OperationDetail operation={operation} />
          </li>
        ))}
      </ul>
      {proposal.operations.length > MAX_LISTED && (
        <p className={styles.more}>and {proposal.operations.length - MAX_LISTED} more</p>
      )}

      {proposal.error && (
        <p role="alert" className={styles.error}>
          {proposal.error}
        </p>
      )}

      {proposal.status === "pending" ? (
        <div className={styles.actions}>
          <button type="button" className={styles.approve} disabled={proposal.busy} onClick={onApprove}>
            Approve
          </button>
          <button type="button" className={styles.reject} disabled={proposal.busy} onClick={onReject}>
            Reject
          </button>
        </div>
      ) : (
        <p role="status" className={styles.outcome}>
          {STATUS_TEXT[proposal.status]}
        </p>
      )}
    </section>
  );
}

function OperationDetail({ operation }: { operation: ProposalOperation }) {
  switch (operation.kind) {
    case "create":
      return (
        <span>
          <strong>Add</strong> {describe(operation.input)}
        </span>
      );
    case "delete":
      return (
        <span>
          <strong>Delete</strong> <s>{describe(operation.before)}</s>
        </span>
      );
    case "update":
      return (
        <span>
          <strong>{operation.before.description}</strong>: {changedFields(operation.before, operation.after)}
        </span>
      );
  }
}

function describe(transaction: TransactionInput | Transaction): string {
  return `${transaction.description}, ${formatMoney(transaction.amount)} ${transaction.type}, ${transaction.category}, ${shortDate(transaction.date)}`;
}

function changedFields(before: Transaction, after: TransactionInput): string {
  const changes: string[] = [];
  if (before.description !== after.description) changes.push(`description → ${after.description}`);
  if (before.amount !== after.amount)
    changes.push(`${formatMoney(before.amount)} → ${formatMoney(after.amount)}`);
  if (before.type !== after.type) changes.push(`${before.type} → ${after.type}`);
  if (before.category !== after.category) changes.push(`${before.category} → ${after.category}`);
  if (before.date !== after.date) changes.push(`${shortDate(before.date)} → ${shortDate(after.date)}`);
  return changes.join(", ") || "no changes";
}

/** Stable keys for list items. Identical rows (two same-day coffees) get a counter so keys stay unique. */
function withKeys(operations: readonly ProposalOperation[]) {
  const seen = new Map<string, number>();
  return operations.map((operation) => {
    const base =
      operation.kind === "create"
        ? `create-${operation.input.date}-${operation.input.description}-${operation.input.amount}`
        : `${operation.kind}-${operation.id}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { key: count === 1 ? base : `${base}-${count}`, operation };
  });
}
