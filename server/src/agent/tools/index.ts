// Every tool the agent can call. Adding a tool means adding a file and a line here.
import { addOrSubtract } from "./addOrSubtract";
import type { AgentTool } from "./defineTool";
import { findRecurringCharges } from "./findRecurringCharges";
import { findTransactions } from "./findTransactions";
import { getSummary } from "./getSummary";
import { proposeCreateTransaction } from "./proposeCreateTransaction";
import { proposeDeleteTransactions } from "./proposeDeleteTransactions";
import { proposeUpdateTransactions } from "./proposeUpdateTransactions";
import { renderChart } from "./renderChart";
import { sumTransactions } from "./sumTransactions";

export const AGENT_TOOLS: readonly AgentTool[] = [
  getSummary,
  sumTransactions,
  findTransactions,
  findRecurringCharges,
  addOrSubtract,
  renderChart,
  proposeCreateTransaction,
  proposeUpdateTransactions,
  proposeDeleteTransactions,
];
