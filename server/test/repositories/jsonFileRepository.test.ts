import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JsonFileTransactionRepository } from "../../src/repositories/jsonFileRepository";
import { seedTransactions } from "../support/testApp";

async function tempFiles() {
  const directory = await mkdtemp(path.join(tmpdir(), "budget-"));
  const seedPath = path.join(directory, "seed.json");
  await writeFile(seedPath, JSON.stringify({ version: 1, transactions: seedTransactions().slice(0, 2) }));
  return { dataPath: path.join(directory, "db.json"), seedPath };
}

describe("JsonFileTransactionRepository", () => {
  it("creates the database from the seed file on first open", async () => {
    const { dataPath, seedPath } = await tempFiles();
    const repository = await JsonFileTransactionRepository.open(dataPath, seedPath);

    expect(await repository.all()).toHaveLength(2);
    expect(JSON.parse(await readFile(dataPath, "utf8")).transactions).toHaveLength(2);
  });

  it("persists changes so a reopened repository sees them", async () => {
    const { dataPath, seedPath } = await tempFiles();
    const repository = await JsonFileTransactionRepository.open(dataPath, seedPath);
    const [first] = await repository.all();
    await repository.applyChanges([{ kind: "remove", id: first!.id }]);

    const reopened = await JsonFileTransactionRepository.open(dataPath, seedPath);
    expect(await reopened.all()).toHaveLength(1);
  });

  it("applies nothing when one change in a batch is invalid", async () => {
    const { dataPath, seedPath } = await tempFiles();
    const repository = await JsonFileTransactionRepository.open(dataPath, seedPath);
    const [first] = await repository.all();

    await expect(
      repository.applyChanges([
        { kind: "remove", id: first!.id },
        { kind: "remove", id: "missing" },
      ]),
    ).rejects.toThrow("missing");
    expect(await repository.all()).toHaveLength(2);
  });
});

describe("JsonFileTransactionRepository when a write fails", () => {
  it("rolls memory back and keeps accepting later writes", async () => {
    const { dataPath, seedPath } = await tempFiles();
    const repository = await JsonFileTransactionRepository.open(dataPath, seedPath);
    const [first, second] = await repository.all();

    // A directory where the database file should be makes the rename fail.
    await rm(dataPath);
    await mkdir(dataPath);
    await writeFile(path.join(dataPath, "blocker"), "");
    await expect(repository.applyChanges([{ kind: "remove", id: first!.id }])).rejects.toThrow();
    expect(await repository.all()).toHaveLength(2);

    await rm(dataPath, { recursive: true });
    await repository.applyChanges([{ kind: "remove", id: second!.id }]);
    expect(JSON.parse(await readFile(dataPath, "utf8")).transactions).toHaveLength(1);
  });
});
