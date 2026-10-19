// The Ask AI conversation as plain data, and the reducer that applies streamed events to it.
import type { AgentEvent, ChartSpec, ChatTurn, Proposal } from "@budget/shared";

export type ProposalState = Proposal & { error?: string | undefined; busy?: boolean };

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** For answers: which tools produced it, sent back with the answer in later history. */
  toolNote?: string | null | undefined;
  charts: ChartSpec[];
  proposals: ProposalState[];
  error?: string | undefined;
};

export type Conversation = {
  messages: ChatMessage[];
  /** Label for what the agent is doing right now, or null when idle. */
  status: string | null;
  /** Suggested next questions from the latest answer. Empty means show the defaults. */
  followUps: string[];
};

export type ConversationAction =
  | { type: "asked"; question: string }
  | { type: "event"; event: AgentEvent }
  | { type: "failed"; message: string }
  | { type: "proposal_updated"; proposalId: string; patch: Partial<ProposalState> };

const GREETING: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "Ask me about your spending, income or savings. I answer from your transactions, draw a chart when it helps, and can propose changes for you to approve.",
  charts: [],
  proposals: [],
};

export const INITIAL_CONVERSATION: Conversation = { messages: [GREETING], status: null, followUps: [] };

export function conversationReducer(state: Conversation, action: ConversationAction): Conversation {
  switch (action.type) {
    case "asked": {
      const nextId = (state.messages.at(-1)?.id ?? 0) + 1;
      return {
        ...state,
        status: "Thinking…",
        messages: [
          ...state.messages,
          {
            id: nextId,
            role: "user",
            text: action.question,
            charts: [],
            proposals: [],
          },
          { id: nextId + 1, role: "assistant", text: "", charts: [], proposals: [] },
        ],
      };
    }
    case "event":
      return applyEvent(state, action.event);
    case "failed":
      return {
        status: null,
        followUps: [],
        messages: updateLast(state.messages, () => ({ error: action.message })),
      };
    case "proposal_updated":
      return {
        ...state,
        messages: state.messages.map((message) => ({
          ...message,
          proposals: message.proposals.map((proposal) =>
            proposal.id === action.proposalId ? { ...proposal, ...action.patch } : proposal,
          ),
        })),
      };
  }
}

function applyEvent(state: Conversation, event: AgentEvent): Conversation {
  switch (event.type) {
    case "status":
      return { ...state, status: event.label };
    case "text":
      return {
        ...state,
        messages: updateLast(state.messages, (last) => ({ text: last.text + event.delta })),
      };
    case "chart":
      return {
        ...state,
        messages: updateLast(state.messages, (last) => ({ charts: [...last.charts, event.chart] })),
      };
    case "proposal":
      return {
        ...state,
        messages: updateLast(state.messages, (last) => ({ proposals: [...last.proposals, event.proposal] })),
      };
    case "error":
      return {
        status: null,
        followUps: [],
        messages: updateLast(state.messages, () => ({ error: event.message })),
      };
    case "done":
      return {
        status: null,
        followUps: event.followUps,
        messages: updateLast(state.messages, () => ({ toolNote: event.toolNote })),
      };
  }
}

function updateLast(
  messages: ChatMessage[],
  patch: (last: ChatMessage) => Partial<ChatMessage>,
): ChatMessage[] {
  const last = messages.at(-1);
  if (!last) return messages;
  return [...messages.slice(0, -1), { ...last, ...patch(last) }];
}

/**
 * What the server sees of earlier turns: the text of each message, plus a note
 * for every proposal the user approved or rejected so the agent knows the outcome.
 */
/** Matches the server's limit for one history turn. */
const MAX_TURN_LENGTH = 4000;

export function historyFor(messages: readonly ChatMessage[], maxTurns = 12): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const message of messages.slice(1)) {
    if (message.text) {
      // The note shows the model that this earlier answer came from tool calls, which
      // aren't in the history themselves. Without it, it doubts its own correct figures.
      const toolNote = message.toolNote ? `\n\n[${message.toolNote}]` : "";
      const text = message.text.slice(0, MAX_TURN_LENGTH - toolNote.length);
      turns.push({ role: message.role, text: text + toolNote });
    }
    for (const proposal of message.proposals) {
      if (proposal.status === "approved" || proposal.status === "rejected") {
        turns.push({ role: "user", text: `(I ${proposal.status} the proposal: ${proposal.summary}.)` });
      }
    }
  }
  return turns.slice(-maxTurns);
}
