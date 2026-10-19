import type { Transaction } from "@budget/shared";
import { NotFoundError } from "../errors";
import type { Change, TransactionRepository } from "./transactionRepository";

/** Keeps transactions in a Map. Used directly by tests and wrapped by the JSON file repository. */
export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly byId = new Map<string, Transaction>();

  constructor(initial: readonly Transaction[] = []) {
    for (const transaction of initial) {
      this.byId.set(transaction.id, transaction);
    }
  }

  async all(): Promise<Transaction[]> {
    return [...this.byId.values()];
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.byId.get(id) ?? null;
  }

  /** Replaces everything at once. Used to roll back when a write to disk fails. */
  replaceAll(transactions: readonly Transaction[]): void {
    this.byId.clear();
    for (const transaction of transactions) this.byId.set(transaction.id, transaction);
  }

  async applyChanges(changes: readonly Change[]): Promise<void> {
    this.assertApplicable(changes);
    for (const change of changes) {
      if (change.kind === "remove") {
        this.byId.delete(change.id);
      } else {
        this.byId.set(change.transaction.id, change.transaction);
      }
    }
  }

  /** Checks the whole batch first so a bad change can't leave a half-applied batch behind. */
  private assertApplicable(changes: readonly Change[]): void {
    const existing = new Set(this.byId.keys());
    for (const change of changes) {
      switch (change.kind) {
        case "insert":
          if (existing.has(change.transaction.id)) {
            throw new Error(`Transaction ${change.transaction.id} already exists.`);
          }
          existing.add(change.transaction.id);
          break;
        case "replace":
          if (!existing.has(change.transaction.id)) {
            throw new NotFoundError(`Transaction ${change.transaction.id} was not found.`);
          }
          break;
        case "remove":
          if (!existing.delete(change.id)) {
            throw new NotFoundError(`Transaction ${change.id} was not found.`);
          }
          break;
      }
    }
  }
}
