// Reads environment variables once at startup. Nothing else reads process.env.
import path from "node:path";
import { z } from "zod";

const SERVER_ROOT = path.resolve(import.meta.dirname, "..");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATA_FILE: z.string().default("data/db.json"),
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  AGENT_MODEL: z.string().default("claude-haiku-5-5"),
  FAST_MODEL: z.string().default("claude-haiku-5-5"),
});

export type Config = {
  port: number;
  dataFile: string;
  seedFile: string;
  anthropicApiKey: string | null;
  agentModel: string;
  fastModel: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
  }
  const values = parsed.data;
  return {
    port: values.PORT,
    dataFile: path.resolve(SERVER_ROOT, values.DATA_FILE),
    seedFile: path.resolve(SERVER_ROOT, "data/seed.json"),
    anthropicApiKey: values.ANTHROPIC_API_KEY || null,
    agentModel: values.AGENT_MODEL,
    fastModel: values.FAST_MODEL,
  };
}
