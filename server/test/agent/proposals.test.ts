import type { AgentEvent } from "@budget/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ScriptedLlmClient } from "../support/fakeLlm";
import { buildTestApp, seedTransactions } from "../support/testApp";

async function findPatioDinner(app: Parameters<typeof request>[0]) {
  const response = await request(app).get("/api/transactions").query({ search: "patio" });
  return response.body[0];
}

describe("agent proposals", () => {
  it("proposes a delete that only happens once the user approves it", async () => {
    const patio = seedTransactions().find((transaction) => transaction.description === "Patio dinner")!;
    const llm = new ScriptedLlmClient(
      [
        { toolCalls: [{ name: "propose_delete_transactions", input: { ids: [patio.id] } }] },
        { text: "I've proposed deleting “Patio dinner” ($92.40). Approve it to remove it." },
      ],
      () => ({ scope: "in_scope" }),
    );
    const { app, dependencies } = buildTestApp({ llm });

    const events = await askThroughHttp(app, "Delete the patio dinner");

    const proposalEvent = events.find((event) => event.type === "proposal");
    if (proposalEvent?.type !== "proposal") throw new Error("expected a proposal");
    expect(proposalEvent.proposal.summary).toBe("Delete “Patio dinner” ($92.40)");
    expect(await findPatioDinner(app)).toBeDefined();

    await request(app).post(`/api/proposals/${proposalEvent.proposal.id}/approve`).expect(200);
    expect(await findPatioDinner(app)).toBeUndefined();

    const again = await request(app).post(`/api/proposals/${proposalEvent.proposal.id}/approve`).expect(409);
    expect(again.body.error.message).toContain("already approved");
    expect(await dependencies.transactions.list()).toHaveLength(36);
  });

  it("applies approved edits and marks them as changed by Ask AI", async () => {
    const { app, dependencies } = buildTestApp();
    const patio = await findPatioDinner(app);
    const proposal = await dependencies.proposals.proposeUpdates([
      { id: patio.id, category: "Entertainment" },
    ]);

    await request(app).post(`/api/proposals/${proposal.id}/approve`).expect(200);

    expect(await findPatioDinner(app)).toMatchObject({ category: "Entertainment", source: "agent" });
  });

  it("refuses to apply a proposal when the transaction changed after it was made", async () => {
    const { app, dependencies } = buildTestApp();
    const patio = await findPatioDinner(app);
    const proposal = await dependencies.proposals.proposeDeletes([patio.id]);
    await request(app).put(`/api/transactions/${patio.id}`).send({
      date: patio.date,
      description: "Patio dinner with Sam",
      amount: patio.amount,
      type: "expense",
      category: "Food",
    });

    const response = await request(app).post(`/api/proposals/${proposal.id}/approve`).expect(409);

    expect(response.body.error.message).toContain("changed after this was proposed");
    expect(await dependencies.transactions.get(patio.id)).toBeDefined();
  });

  it("rejects invalid edits when the proposal is made", async () => {
    const { app, dependencies } = buildTestApp();
    const patio = await findPatioDinner(app);
    await expect(dependencies.proposals.proposeUpdates([{ id: patio.id, type: "income" }])).rejects.toThrow(
      "Some fields are invalid.",
    );
  });

  it("applies a proposal once even if Approve is clicked twice at the same moment", async () => {
    const { app, dependencies } = buildTestApp();
    const proposal = dependencies.proposals.proposeCreate({
      date: "2026-10-15",
      description: "Coffee",
      amount: 4.5,
      type: "expense",
      category: "Food",
    });

    const [first, second] = await Promise.all([
      request(app).post(`/api/proposals/${proposal.id}/approve`),
      request(app).post(`/api/proposals/${proposal.id}/approve`),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await dependencies.transactions.list({ search: "coffee" })).toHaveLength(1);
  });

  it("merges two edits to the same transaction instead of dropping one", async () => {
    const { app, dependencies } = buildTestApp();
    const patio = await findPatioDinner(app);
    const proposal = await dependencies.proposals.proposeUpdates([
      { id: patio.id, category: "Entertainment" },
      { id: patio.id, amount: 100 },
    ]);

    await request(app).post(`/api/proposals/${proposal.id}/approve`).expect(200);

    expect(proposal.operations).toHaveLength(1);
    expect(await findPatioDinner(app)).toMatchObject({ category: "Entertainment", amount: 100 });
  });

  it("can reject a proposal", async () => {
    const { app, dependencies } = buildTestApp();
    const proposal = dependencies.proposals.proposeCreate({
      date: "2026-10-15",
      description: "Coffee",
      amount: 4.5,
      type: "expense",
      category: "Food",
    });
    const response = await request(app).post(`/api/proposals/${proposal.id}/reject`).expect(200);
    expect(response.body.proposal.status).toBe("rejected");
  });
});

describe("POST /api/insights/ask", () => {
  it("answers 503 with setup instructions when there is no API key", async () => {
    const { app } = buildTestApp({ llm: null });
    const response = await request(app)
      .post("/api/insights/ask")
      .send({ question: "Where did my money go?", month: "2026-10" })
      .expect(503);
    expect(response.body.error.message).toContain("ANTHROPIC_API_KEY");
  });

  it("sends an error event if answering fails after streaming starts", async () => {
    const { app, dependencies } = buildTestApp({ llm: new ScriptedLlmClient() });
    dependencies.transactions.months = async () => {
      throw new Error("disk on fire");
    };

    const response = await request(app)
      .post("/api/insights/ask")
      .send({ question: "Where did my money go?", month: "2026-10" })
      .expect(200);

    expect(response.text).toContain('"type":"error"');
  });

  it("validates the question before streaming", async () => {
    const { app } = buildTestApp({ llm: new ScriptedLlmClient() });
    await request(app).post("/api/insights/ask").send({ question: "", month: "2026-10" }).expect(400);
  });
});

/** Sends a question through the real SSE endpoint and parses the streamed events. */
async function askThroughHttp(app: Parameters<typeof request>[0], question: string): Promise<AgentEvent[]> {
  const response = await request(app)
    .post("/api/insights/ask")
    .send({ question, month: "2026-10" })
    .expect(200)
    .expect("content-type", /text\/event-stream/);
  return response.text
    .split("\n\n")
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice("data: ".length)));
}
