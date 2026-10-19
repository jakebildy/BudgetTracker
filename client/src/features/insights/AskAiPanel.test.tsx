import type { AgentEvent, Proposal } from "@budget/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "../../test/render";
import { AskAiPanel } from "./AskAiPanel";
import { conversationReducer, historyFor, INITIAL_CONVERSATION } from "./conversation";

const proposal: Proposal = {
  id: "p1",
  summary: "Delete “Patio dinner” ($92.40)",
  status: "pending",
  createdAt: "2026-10-15T00:00:00.000Z",
  expiresAt: "2026-10-15T00:15:00.000Z",
  operations: [
    {
      kind: "delete",
      id: "t1",
      before: {
        id: "t1",
        date: "2026-07-18",
        description: "Patio dinner",
        amount: 92.4,
        type: "expense",
        category: "Food",
        source: "manual",
        createdAt: "",
        updatedAt: "",
      },
    },
  ],
};

/** Answers Ask AI with a stream of events, split across chunks the way a network would. */
function streamOf(events: AgentEvent[]): Response {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  const chunks = [text.slice(0, 25), text.slice(25)];
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

function installAskAiApi(events: AgentEvent[]) {
  const calls: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit = {}) => {
      calls.push({ path, body: typeof init.body === "string" ? JSON.parse(init.body) : undefined });
      if (path === "/api/insights/ask") return streamOf(events);
      if (path === "/api/proposals/p1/approve") {
        return Response.json({ proposal: { ...proposal, status: "approved" }, changed: 1 });
      }
      return Response.json({}, { status: 404 });
    }),
  );
  return calls;
}

describe("AskAiPanel", () => {
  it("streams an answer with a chart", async () => {
    installAskAiApi([
      { type: "status", label: "Thinking…" },
      { type: "text", delta: "Housing was your biggest " },
      { type: "text", delta: "expense at $1,650.00." },
      {
        type: "chart",
        chart: {
          kind: "bar",
          title: "October spending",
          items: [{ label: "Housing", value: 1650, valueLabel: "$1,650.00" }],
        },
      },
      {
        type: "done",
        offTopic: false,
        toolsUsed: ["sum_transactions", "render_chart"],
        toolNote: null,
        followUps: [],
      },
    ]);
    renderWithQueryClient(<AskAiPanel month="2026-10" />);

    await userEvent.click(screen.getByRole("button", { name: "Show my spending as a pie chart" }));

    const log = screen.getByRole("log", { name: "Conversation" });
    expect(
      await within(log).findByText("Housing was your biggest expense at $1,650.00."),
    ).toBeInTheDocument();
    expect(
      within(log).getByRole("img", { name: /October spending: Housing \$1,650.00/ }),
    ).toBeInTheDocument();
    await waitFor(() => expect(log).toHaveAttribute("aria-busy", "false"));
  });

  it("applies a proposal only when the user approves it", async () => {
    const calls = installAskAiApi([
      { type: "text", delta: "I've proposed deleting it. Approve to apply." },
      { type: "proposal", proposal },
      {
        type: "done",
        offTopic: false,
        toolsUsed: ["propose_delete_transactions"],
        toolNote: null,
        followUps: [],
      },
    ]);
    renderWithQueryClient(<AskAiPanel month="2026-10" />);

    await userEvent.type(screen.getByLabelText("Ask about your spending"), "Delete the patio dinner");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const card = await screen.findByRole("region", { name: /Proposed change/ });
    expect(calls.some((call) => call.path.includes("/approve"))).toBe(false);

    await userEvent.click(within(card).getByRole("button", { name: "Approve" }));

    expect(await within(card).findByText("Approved and applied.")).toBeInTheDocument();
    expect(calls.some((call) => call.path === "/api/proposals/p1/approve")).toBe(true);
  });
});

describe("waiting for an answer", () => {
  it("shows what the agent is doing until the answer is complete, then the whole answer", async () => {
    let finish: (() => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            const event = (value: AgentEvent) => encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
            controller.enqueue(event({ type: "status", label: "Adding up “food”" }));
            controller.enqueue(event({ type: "text", delta: "You spent $216.87 " }));
            finish = () => {
              controller.enqueue(event({ type: "text", delta: "on food." }));
              controller.enqueue(
                event({ type: "done", offTopic: false, toolsUsed: [], toolNote: null, followUps: [] }),
              );
              controller.close();
            };
          },
        });
        return new Response(body, { headers: { "content-type": "text/event-stream" } });
      }),
    );
    renderWithQueryClient(<AskAiPanel month="2026-10" />);

    await userEvent.click(screen.getByRole("button", { name: "Show my spending as a pie chart" }));

    expect(await screen.findByText("Adding up “food”")).toBeInTheDocument();
    expect(screen.queryByText(/You spent/)).toBeNull();

    finish?.();
    expect(await screen.findByText("You spent $216.87 on food.")).toBeInTheDocument();
    expect(screen.queryByText("Adding up “food”")).toBeNull();
  });
});

describe("follow-up questions", () => {
  it("replaces the default chips with the answer's follow-ups, and sends one when tapped", async () => {
    const calls = installAskAiApi([
      { type: "text", delta: "You spent $216.87 on food." },
      {
        type: "done",
        offTopic: false,
        toolsUsed: ["sum_transactions"],
        toolNote: null,
        followUps: ["Which food merchant costs the most?", "Is food up from September?"],
      },
    ]);
    renderWithQueryClient(<AskAiPanel month="2026-10" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Show my spending as a pie chart" }));
    const followUp = await screen.findByRole("button", { name: "Is food up from September?" });
    expect(screen.queryByRole("button", { name: "Show my spending as a pie chart" })).toBeNull();

    await user.click(followUp);
    await waitFor(() => expect(calls.filter((call) => call.path === "/api/insights/ask")).toHaveLength(2));
    expect(calls.at(-1)?.body).toMatchObject({ question: "Is food up from September?" });
  });

  it("goes back to the defaults when an answer has no follow-ups", () => {
    let state = conversationReducer(INITIAL_CONVERSATION, { type: "asked", question: "Hi" });
    state = conversationReducer(state, {
      type: "event",
      event: { type: "done", offTopic: false, toolsUsed: [], toolNote: null, followUps: ["Next?"] },
    });
    state = conversationReducer(state, { type: "asked", question: "Capital of Portugal?" });
    state = conversationReducer(state, {
      type: "event",
      event: { type: "done", offTopic: true, toolsUsed: [], toolNote: null, followUps: [] },
    });
    expect(state.followUps).toEqual([]);
  });
});

describe("historyFor", () => {
  it("sends each answer back with a note of the tools behind it", () => {
    let state = conversationReducer(INITIAL_CONVERSATION, {
      type: "asked",
      question: "What did I spend on food?",
    });
    state = conversationReducer(state, {
      type: "event",
      event: { type: "text", delta: "$216.87 in October." },
    });
    state = conversationReducer(state, {
      type: "event",
      event: {
        type: "done",
        offTopic: false,
        toolsUsed: ["sum_transactions"],
        toolNote: "Looked up with: sum_transactions(type=expense, categories=Food)",
        followUps: [],
      },
    });

    expect(historyFor(state.messages)[1]).toEqual({
      role: "assistant",
      text: "$216.87 in October.\n\n[Looked up with: sum_transactions(type=expense, categories=Food)]",
    });
  });

  it("tells the agent which proposals the user decided on", () => {
    let state = conversationReducer(INITIAL_CONVERSATION, {
      type: "asked",
      question: "Delete the patio dinner",
    });
    state = conversationReducer(state, { type: "event", event: { type: "text", delta: "Proposed." } });
    state = conversationReducer(state, { type: "event", event: { type: "proposal", proposal } });
    state = conversationReducer(state, {
      type: "proposal_updated",
      proposalId: "p1",
      patch: { status: "approved" },
    });

    expect(historyFor(state.messages)).toEqual([
      { role: "user", text: "Delete the patio dinner" },
      { role: "assistant", text: "Proposed." },
      { role: "user", text: "(I approved the proposal: Delete “Patio dinner” ($92.40).)" },
    ]);
  });
});
