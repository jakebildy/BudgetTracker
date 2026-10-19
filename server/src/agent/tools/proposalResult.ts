import type { Proposal } from "@budget/shared";

/** What the model is told after it proposes a change. */
export function proposalResult(proposal: Proposal) {
  return {
    proposalId: proposal.id,
    summary: proposal.summary,
    status: "awaiting_user_approval",
    note: "Not applied yet. The user sees Approve and Reject buttons. Tell them what you proposed.",
  };
}
