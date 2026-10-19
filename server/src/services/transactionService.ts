// Business rules for transactions. Routes, CSV import and the agent all go through here.
import { randomUUID } from "node:crypto";
import {
  monthOf,
  type Transaction,
  type TransactionCriteria,
  type TransactionInput,
  type TransactionSource,
} from "@budget/shared";
import type { Clock } from "../clock";
import { matchesCriteria, newestFirst } from "../domain/criteria";
import { NotFoundError } from "../errors";
import type { Change, TransactionRepository } from "../repositories/transactionRepository";

export type TransactionBatch = {
  creates?: readonly TransactionInput[];
  updates?: readonly { id: string; input: TransactionInput }[];
  deletes?: readonly string[];
};

export class TransactionService {
  constructor(
    private readonly repository: TransactionRepository,
    private readonly clock: Clock,
    private readonly newId: () => string = randomUUID,
  ) {}

  async list(criteria: TransactionCriteria = {}): Promise<Transaction[]> {
    const all = await this.repository.all();
    return all.filter((transaction) => matchesCriteria(transaction, criteria)).sort(newestFirst);
  }

  async get(id: string): Promise<Transaction> {
    const transaction = await this.repository.findById(id);
    if (!transaction) throw new NotFoundError(`Transaction ${id} was not found.`);
    return transaction;
  }

  async create(input: TransactionInput, source: TransactionSource = "manual"): Promise<Transaction> {
    const transaction = this.buildNew(input, source);
    await this.repository.applyChanges([{ kind: "insert", transaction }]);
    return transaction;
  }

  async update(id: string, input: TransactionInput): Promise<Transaction> {
    const updated = this.buildUpdated(await this.get(id), input);
    await this.repository.applyChanges([{ kind: "replace", transaction: updated }]);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.repository.applyChanges([{ kind: "remove", id }]);
  }

  /** Months that have at least one transaction, oldest first. */
  async months(): Promise<string[]> {
    const all = await this.repository.all();
    return [...new Set(all.map((transaction) => monthOf(transaction.date)))].sort();
  }

  /** Applies creates, updates and deletes together: all succeed or none do. Returns how many changed. */
  async applyBatch(batch: TransactionBatch, source: TransactionSource): Promise<number> {
    const changes: Change[] = [];
    for (const input of batch.creates ?? []) {
      changes.push({ kind: "insert", transaction: this.buildNew(input, source) });
    }
    for (const { id, input } of batch.updates ?? []) {
      const updated = { ...this.buildUpdated(await this.get(id), input), source };
      changes.push({ kind: "replace", transaction: updated });
    }
    for (const id of batch.deletes ?? []) {
      changes.push({ kind: "remove", id });
    }
    await this.repository.applyChanges(changes);
    return changes.length;
  }

  private buildNew(input: TransactionInput, source: TransactionSource): Transaction {
    const now = this.clock.now().toISOString();
    return { id: this.newId(), ...input, source, createdAt: now, updatedAt: now };
  }

  private buildUpdated(existing: Transaction, input: TransactionInput): Transaction {
    return { ...existing, ...input, updatedAt: this.clock.now().toISOString() };
  }
}
