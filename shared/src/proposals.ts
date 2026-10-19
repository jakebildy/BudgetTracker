// Changes the agent wants to make. Nothing here is applied until the user approves it.
import type { Transaction, TransactionInput } from "./transaction";

export type ProposalOperation =
  | { kind: "create"; input: TransactionInput }
  | { kind: "update"; id: string; before: Transaction; after: TransactionInput }
  | { kind: "delete"; id: string; before: Transaction };

export type ProposalStatus = "pending" | "approved" | "rejected" | "expired";

export type Proposal = {
  id: string;
  summary: string;
  operations: ProposalOperation[];
  status: ProposalStatus;
  createdAt: string;
  expiresAt: string;
};

/** POST /api/proposals/:id/approve */
export type ApproveProposalResponse = {
  proposal: Proposal;
  changed: number;
};

/** POST /api/proposals/:id/reject */
export type RejectProposalResponse = {
  proposal: Proposal;
};
