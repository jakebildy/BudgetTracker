import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "../support/testApp";

const groceries = {
  date: "2026-10-14",
  description: "  Groceries at Save-On  ",
  amount: 54.2,
  type: "expense",
  category: "Food",
};

describe("GET /api/transactions", () => {
  it("lists everything, newest first", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/api/transactions").expect(200);
    expect(response.body).toHaveLength(37);
    expect(response.body[0].date).toBe("2026-10-13");
  });

  it("filters by type, category, search and month", async () => {
    const { app } = buildTestApp();
    const response = await request(app)
      .get("/api/transactions")
      .query({ type: "expense", category: "Food", search: "dinner", month: "2026-10" })
      .expect(200);
    expect(response.body.map((t: { description: string }) => t.description)).toEqual(["Dinner out"]);
  });

  it("matches a category in any case", async () => {
    const { app } = buildTestApp();
    const response = await request(app)
      .get("/api/transactions")
      .query({ category: "food", month: "2026-10" })
      .expect(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.every((t: { category: string }) => t.category === "Food")).toBe(true);
  });

  it("rejects an unknown type", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/api/transactions?type=gift").expect(400);
    expect(response.body.error.code).toBe("validation_failed");
  });
});

describe("POST /api/transactions", () => {
  it("creates a transaction with a generated id and trimmed description", async () => {
    const { app } = buildTestApp();
    const response = await request(app).post("/api/transactions").send(groceries).expect(201);
    expect(response.body).toMatchObject({ description: "Groceries at Save-On", source: "manual" });
    expect(response.body.id).toEqual(expect.any(String));
  });

  it("explains each invalid field", async () => {
    const { app } = buildTestApp();
    const response = await request(app)
      .post("/api/transactions")
      .send({ ...groceries, amount: -5, date: "2026-02-30", description: "" })
      .expect(400);
    expect(Object.keys(response.body.error.fields).sort()).toEqual(["amount", "date", "description"]);
  });

  it("rejects a category that doesn't belong to the type", async () => {
    const { app } = buildTestApp();
    const response = await request(app)
      .post("/api/transactions")
      .send({ ...groceries, type: "income", category: "Food" })
      .expect(400);
    expect(response.body.error.fields.category).toBeDefined();
  });

  it("rejects amounts with more than two decimals", async () => {
    const { app } = buildTestApp();
    await request(app)
      .post("/api/transactions")
      .send({ ...groceries, amount: 1.234 })
      .expect(400);
  });
});

describe("PUT and DELETE /api/transactions/:id", () => {
  it("updates, then deletes, a transaction", async () => {
    const { app } = buildTestApp();
    const created = (await request(app).post("/api/transactions").send(groceries)).body;

    const updated = await request(app)
      .put(`/api/transactions/${created.id}`)
      .send({ ...groceries, amount: 60 })
      .expect(200);
    expect(updated.body.amount).toBe(60);

    await request(app).delete(`/api/transactions/${created.id}`).expect(204);
    await request(app).delete(`/api/transactions/${created.id}`).expect(404);
  });

  it("returns 404 when updating a missing transaction", async () => {
    const { app } = buildTestApp();
    const response = await request(app).put("/api/transactions/nope").send(groceries).expect(404);
    expect(response.body.error.code).toBe("not_found");
  });
});

describe("GET /api/summary and /api/months", () => {
  it("returns all-time totals without a month", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/api/summary").expect(200);
    expect(response.body).toMatchObject({ month: null, totalIncome: 15100, previous: null });
  });

  it("lists months that have data", async () => {
    const { app } = buildTestApp();
    const response = await request(app).get("/api/months").expect(200);
    expect(response.body.months).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
  });
});

describe("unknown routes and bad JSON", () => {
  it("returns the standard error shape", async () => {
    const { app } = buildTestApp();
    const missing = await request(app).get("/api/nothing").expect(404);
    expect(missing.body.error.code).toBe("not_found");

    const badJson = await request(app)
      .post("/api/transactions")
      .set("content-type", "application/json")
      .send("{not json")
      .expect(400);
    expect(badJson.body.error.code).toBe("validation_failed");
  });
});
