// Storage boundary. Services read and write transactions only through this interface.
import type { Transaction } from "@budget/shared";

export type Change =
  | { kind: "insert"; transaction: Transaction }
  | { kind: "replace"; transaction: Transaction }
  | { kind: "remove"; id: string };

export interface TransactionRepository {
  all(): Promise<Transaction[]>;
  findById(id: string): Promise<Transaction | null>;
  /** Applies every change or none of them. */
  applyChanges(changes: readonly Change[]): Promise<void>;
}
