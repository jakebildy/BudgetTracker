// Persists transactions to a JSON file. Reads come from memory. Changes run one
// at a time: apply in memory, write to disk (temp file then rename, so a crash
// can't leave a half-written file), and roll memory back if the write fails.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { type Transaction, TransactionSchema } from "@budget/shared";
import { z } from "zod";
import { InMemoryTransactionRepository } from "./inMemoryRepository";
import type { Change, TransactionRepository } from "./transactionRepository";

const DatabaseFileSchema = z.object({
  version: z.literal(1),
  transactions: z.array(TransactionSchema),
});

export class JsonFileTransactionRepository implements TransactionRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly filePath: string,
    private readonly memory: InMemoryTransactionRepository,
  ) {}

  /** Opens the database file, creating it from the seed file the first time. */
  static async open(filePath: string, seedPath: string): Promise<JsonFileTransactionRepository> {
    const existing = await readDatabaseFile(filePath);
    const transactions = existing ?? (await readDatabaseFile(seedPath)) ?? [];
    const repository = new JsonFileTransactionRepository(
      filePath,
      new InMemoryTransactionRepository(transactions),
    );
    if (!existing) {
      await repository.persist();
    }
    return repository;
  }

  all(): Promise<Transaction[]> {
    return this.memory.all();
  }

  findById(id: string): Promise<Transaction | null> {
    return this.memory.findById(id);
  }

  applyChanges(changes: readonly Change[]): Promise<void> {
    return this.enqueue(async () => {
      const before = await this.memory.all();
      await this.memory.applyChanges(changes);
      try {
        await this.writeToDisk();
      } catch (error) {
        this.memory.replaceAll(before);
        throw error;
      }
    });
  }

  private persist(): Promise<void> {
    return this.enqueue(() => this.writeToDisk());
  }

  /** Runs tasks one after another. A failed task doesn't block the ones after it. */
  private enqueue(task: () => Promise<void>): Promise<void> {
    const result = this.writeQueue.then(task);
    this.writeQueue = result.catch(() => {});
    return result;
  }

  private async writeToDisk(): Promise<void> {
    const contents = { version: 1, transactions: await this.memory.all() };
    await writeFileAtomically(this.filePath, `${JSON.stringify(contents, null, 2)}\n`);
  }
}

async function readDatabaseFile(filePath: string): Promise<Transaction[] | null> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed = DatabaseFileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(`${filePath} is not a valid database file. Run "npm run db:reset" to start over.`);
  }
  return parsed.data.transactions;
}

async function writeFileAtomically(filePath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, contents, "utf8");
  await rename(tempPath, filePath);
}
