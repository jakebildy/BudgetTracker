// Changes the agent proposes. They wait here, in memory, until the user approves
// or rejects them. Approving re-checks that nothing changed in the meantime.
import { randomUUID } from "node:crypto";
import {
  formatDollars,
  type Proposal,
  type ProposalOperation,
  type Transaction,
  type TransactionInput,
  TransactionInputSchema,
} from "@budget/shared";
import type { Clock } from "../clock";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import type { TransactionService } from "./transactionService";

const PROPOSAL_LIFETIME_MS = 15 * 60 * 1000;

/** The id of a transaction plus only the fields that change. */
export type TransactionChange = { id: string } & {
  [Field in keyof TransactionInput]?: TransactionInput[Field] | undefined;
};

export class ProposalService {
  private readonly proposals = new Map<string, Proposal>();
  /** Proposals being applied right now, so a double-click can't apply one twice. */
  private readonly applying = new Set<string>();

  constructor(
    private readonly transactions: TransactionService,
    private readonly clock: Clock,
    private readonly newId: () => string = randomUUID,
  ) {}

  proposeCreate(input: TransactionInput): Proposal {
    return this.store([{ kind: "create", input }]);
  }

  async proposeUpdates(changes: readonly TransactionChange[]): Promise<Proposal> {
    const operations: ProposalOperation[] = [];
    for (const { id, ...fields } of mergeChangesById(changes)) {
      const before = await this.transactions.get(id);
      const parsed = TransactionInputSchema.safeParse({ ...inputOf(before), ...withoutUndefined(fields) });
      if (!parsed.success) {
        throw ValidationError.fromZod(parsed.error);
      }
      operations.push({ kind: "update", id, before, after: parsed.data });
    }
    return this.store(operations);
  }

  async proposeDeletes(ids: readonly string[]): Promise<Proposal> {
    const operations: ProposalOperation[] = [];
    for (const id of new Set(ids)) {
      operations.push({ kind: "delete", id, before: await this.transactions.get(id) });
    }
    return this.store(operations);
  }

  async approve(id: string): Promise<{ proposal: Proposal; changed: number }> {
    const proposal = this.requirePending(id);
    if (this.applying.has(id)) throw new ConflictError("This proposal is already being applied.");
    this.applying.add(id);
    try {
      await this.assertNothingChanged(proposal);
      const changed = await this.transactions.applyBatch(
        {
          creates: proposal.operations.flatMap((op) => (op.kind === "create" ? [op.input] : [])),
          updates: proposal.operations.flatMap((op) =>
            op.kind === "update" ? [{ id: op.id, input: op.after }] : [],
          ),
          deletes: proposal.operations.flatMap((op) => (op.kind === "delete" ? [op.id] : [])),
        },
        "agent",
      );
      return { proposal: this.setStatus(proposal, "approved"), changed };
    } finally {
      this.applying.delete(id);
    }
  }

  reject(id: string): { proposal: Proposal } {
    return { proposal: this.setStatus(this.requirePending(id), "rejected") };
  }

  private store(operations: ProposalOperation[]): Proposal {
    const now = this.clock.now();
    const proposal: Proposal = {
      id: this.newId(),
      summary: summarize(operations),
      operations,
      status: "pending",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PROPOSAL_LIFETIME_MS).toISOString(),
    };
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  private requirePending(id: string): Proposal {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new NotFoundError("That proposal no longer exists. Ask again to get a new one.");
    if (proposal.status !== "pending")
      throw new ConflictError(`This proposal was already ${proposal.status}.`);
    if (this.clock.now().toISOString() > proposal.expiresAt) {
      this.setStatus(proposal, "expired");
      throw new ConflictError("This proposal expired. Ask again to get a fresh one.");
    }
    return proposal;
  }

  /** Refuses to apply a proposal if any transaction it touches was edited or deleted since. */
  private async assertNothingChanged(proposal: Proposal): Promise<void> {
    for (const operation of proposal.operations) {
      if (operation.kind === "create") continue;
      const current = await this.transactions.get(operation.id).catch(() => null);
      if (!current || current.updatedAt !== operation.before.updatedAt) {
        this.setStatus(proposal, "expired");
        throw new ConflictError(
          `“${operation.before.description}” changed after this was proposed. Ask again to get a fresh proposal.`,
        );
      }
    }
  }

  private setStatus(proposal: Proposal, status: Proposal["status"]): Proposal {
    const updated = { ...proposal, status };
    this.proposals.set(proposal.id, updated);
    return updated;
  }
}

/** Combines several changes to the same transaction into one, so none is silently lost. */
function mergeChangesById(changes: readonly TransactionChange[]): TransactionChange[] {
  const merged = new Map<string, TransactionChange>();
  for (const change of changes) {
    merged.set(change.id, { ...merged.get(change.id), ...withoutUndefined(change), id: change.id });
  }
  return [...merged.values()];
}

function withoutUndefined(fields: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function inputOf(transaction: Transaction): TransactionInput {
  const { date, description, amount, type, category } = transaction;
  return { date, description, amount, type, category };
}

function summarize(operations: readonly ProposalOperation[]): string {
  const [first] = operations;
  if (!first) return "No changes";
  if (operations.length > 1) {
    const verb = { create: "Add", update: "Update", delete: "Delete" }[first.kind];
    return `${verb} ${operations.length} transactions`;
  }
  switch (first.kind) {
    case "create":
      return `Add “${first.input.description}” (${formatDollars(first.input.amount)}, ${first.input.category})`;
    case "update":
      return `Update “${first.before.description}”`;
    case "delete":
      return `Delete “${first.before.description}” (${formatDollars(first.before.amount)})`;
  }
}
