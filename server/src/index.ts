import { createApp } from "./app";
import { systemClock } from "./clock";
import { loadConfig } from "./config";
import { buildDependencies } from "./container";
import { AnthropicLlmClient } from "./llm/anthropicClient";
import { JsonFileTransactionRepository } from "./repositories/jsonFileRepository";

const config = loadConfig();
const repository = await JsonFileTransactionRepository.open(config.dataFile, config.seedFile);
const llm = config.anthropicApiKey ? new AnthropicLlmClient(config.anthropicApiKey) : null;
const app = createApp(
  buildDependencies({
    repository,
    clock: systemClock,
    llm,
    models: { agent: config.agentModel, fast: config.fastModel },
  }),
);

if (!llm) {
  console.warn(
    "ANTHROPIC_API_KEY is not set: AI features are off. Add it to server/.env (see .env.example).",
  );
}

app.listen(config.port, () => {
  console.log(`Budget Tracker API listening on http://localhost:${config.port}`);
});
