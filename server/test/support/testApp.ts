import { readFileSync } from "node:fs";
import path from "node:path";
import type { Transaction } from "@budget/shared";
import { createApp } from "../../src/app";
import { fixedClock } from "../../src/clock";
import { buildDependencies } from "../../src/container";
import type { LlmClient } from "../../src/llm/types";
import { InMemoryTransactionRepository } from "../../src/repositories/inMemoryRepository";

export const TEST_NOW = "2026-10-15T18:00:00.000Z";

export function seedTransactions(): Transaction[] {
  const file = path.resolve(import.meta.dirname, "../../data/seed.json");
  return JSON.parse(readFileSync(file, "utf8")).transactions;
}

type TestOptions = { transactions?: Transaction[]; llm?: LlmClient | null };

export function buildTestDependencies({ transactions = seedTransactions(), llm = null }: TestOptions = {}) {
  const repository = new InMemoryTransactionRepository(transactions);
  return buildDependencies({
    repository,
    clock: fixedClock(TEST_NOW),
    llm,
    models: { agent: "test-agent-model", fast: "test-fast-model" },
  });
}

export function buildTestApp(options: TestOptions = {}) {
  const dependencies = buildTestDependencies(options);
  return { app: createApp(dependencies), dependencies };
}
