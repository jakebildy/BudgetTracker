// The Ask AI contract: the request, the chart shapes, and the events streamed back over SSE.
import { z } from "zod";
import { MonthKeySchema } from "./dates";
import type { Proposal } from "./proposals";

export const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(4000),
});

export const AskRequestSchema = z.object({
  question: z.string().trim().min(1, "Ask a question.").max(500, "Keep questions under 500 characters."),
  month: MonthKeySchema,
  history: z.array(ChatTurnSchema).max(12).default([]),
});

export type ChatTurn = z.infer<typeof ChatTurnSchema>;
export type AskRequest = z.input<typeof AskRequestSchema>;

export type BarChart = {
  kind: "bar";
  title: string;
  items: { label: string; value: number; valueLabel: string; category?: string }[];
};

export type ColumnChart = {
  kind: "column";
  title: string;
  groups: { label: string; income: number; expense: number }[];
};

export type PieChart = {
  kind: "pie";
  title: string;
  slices: { label: string; value: number; valueLabel: string; share: number; category?: string }[];
};

export type ChartSpec = BarChart | ColumnChart | PieChart;
export type ChartKind = ChartSpec["kind"];

export type AgentEvent =
  | { type: "status"; label: string }
  | { type: "text"; delta: string }
  | { type: "chart"; chart: ChartSpec }
  | { type: "proposal"; proposal: Proposal }
  | {
      type: "done";
      offTopic: boolean;
      toolsUsed: string[];
      /** Compact record of the tool calls behind this answer, to send back with it in later history. */
      toolNote: string | null;
      /** Up to 3 questions to offer next, suggested from this question. Empty means use the defaults. */
      followUps: string[];
    }
  | { type: "error"; message: string };

/** Sent by code, without a model call, when the scope check says a question is off topic. */
export const OFF_TOPIC_REPLY =
  "I can only help with your transactions and budget. Try asking where your money went this month, or how one category has changed over time.";

/** Shown before the first question, and whenever an answer comes back without follow-ups. */
export const SUGGESTED_QUESTIONS = [
  "Show my spending as a pie chart",
  "What subscriptions do I pay for?",
  "Compare the last 4 months",
  "Am I saving more?",
] as const;
