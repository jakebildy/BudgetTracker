import { useEffect, useReducer, useRef } from "react";
import { approveProposal, askInsights, rejectProposal } from "../../api/ai";
import { ApiRequestError } from "../../api/http";
import { useRefreshTransactionData } from "../transactions/hooks";
import { conversationReducer, historyFor, INITIAL_CONVERSATION } from "./conversation";
import { readEventStream } from "./readEventStream";

/** Runs the Ask AI conversation: streams answers and handles proposal approvals. */
export function useAskAi(month: string) {
  const [conversation, dispatch] = useReducer(conversationReducer, INITIAL_CONVERSATION);
  const inFlight = useRef<AbortController | null>(null);
  const refreshTransactions = useRefreshTransactionData();

  useEffect(() => () => inFlight.current?.abort(), []);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || conversation.status !== null) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const history = historyFor(conversation.messages);
    dispatch({ type: "asked", question: trimmed });

    try {
      const response = await askInsights({ question: trimmed, month, history }, controller.signal);
      let finished = false;
      for await (const event of readEventStream(response)) {
        dispatch({ type: "event", event });
        if (event.type === "done" || event.type === "error") finished = true;
      }
      if (!finished) dispatch({ type: "failed", message: "The answer was cut off. Try asking again." });
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({ type: "failed", message: errorMessage(error) });
    }
  }

  async function decide(proposalId: string, decision: "approve" | "reject") {
    dispatch({ type: "proposal_updated", proposalId, patch: { busy: true, error: undefined } });
    try {
      const { proposal } =
        decision === "approve" ? await approveProposal(proposalId) : await rejectProposal(proposalId);
      dispatch({ type: "proposal_updated", proposalId, patch: { status: proposal.status, busy: false } });
      if (decision === "approve") await refreshTransactions();
    } catch (error) {
      // 409 means the proposal can no longer be applied (stale, expired or already decided).
      const noLongerValid = error instanceof ApiRequestError && error.status === 409;
      dispatch({
        type: "proposal_updated",
        proposalId,
        patch: {
          busy: false,
          error: errorMessage(error),
          ...(noLongerValid && { status: "expired" as const }),
        },
      });
    }
  }

  return {
    messages: conversation.messages,
    status: conversation.status,
    followUps: conversation.followUps,
    ask,
    approve: (proposalId: string) => decide(proposalId, "approve"),
    reject: (proposalId: string) => decide(proposalId, "reject"),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Couldn't reach Ask AI. Is the server running?";
}
