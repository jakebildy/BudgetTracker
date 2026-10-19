// The one place that chooses concrete implementations and wires them together.
import { InsightsService } from "./agent/insightsService";
import type { Clock } from "./clock";
import type { LlmClient } from "./llm/types";
import type { TransactionRepository } from "./repositories/transactionRepository";
import { ProposalService } from "./services/proposalService";
import { SummaryService } from "./services/summaryService";
import { TransactionService } from "./services/transactionService";

export type AppDependencies = {
  transactions: TransactionService;
  summary: SummaryService;
  proposals: ProposalService;
  insights: InsightsService;
};

export type Infrastructure = {
  repository: TransactionRepository;
  clock: Clock;
  /** Null when no API key is configured; AI endpoints then answer 503 with setup instructions. */
  llm: LlmClient | null;
  models: { agent: string; fast: string };
};

export function buildDependencies({ repository, clock, llm, models }: Infrastructure): AppDependencies {
  const transactions = new TransactionService(repository, clock);
  const summary = new SummaryService(transactions);
  const proposals = new ProposalService(transactions, clock);
  const insights = new InsightsService({
    llm,
    agentModel: models.agent,
    fastModel: models.fast,
    transactions,
    summary,
    proposals,
    clock,
  });
  return { transactions, summary, proposals, insights };
}
