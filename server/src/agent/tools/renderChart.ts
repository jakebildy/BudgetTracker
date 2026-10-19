import { z } from "zod";
import { buildChart } from "../charts";
import { defineTool, ToolError } from "./defineTool";

export const renderChart = defineTool({
  name: "render_chart",
  description:
    "Shows a chart under your answer, built from a dataset an earlier tool returned. " +
    "kind 'bar': compare categories or months (from sum_transactions grouped by month or category). " +
    "kind 'column': income against expenses per month (from get_summary). " +
    "kind 'pie': how one expense or income total splits across categories (from sum_transactions grouped by category). " +
    "Use at most one chart per answer, and only when it adds something the sentence doesn't.",
  input: z.object({
    datasetId: z.string().describe("The datasetId from get_summary or sum_transactions, like 'ds_1'."),
    kind: z.enum(["bar", "column", "pie"]),
    title: z.string().min(1).max(60).describe("Short chart title, like 'October spending by category'."),
  }),
  statusLabel: () => "Drawing a chart",
  run: async ({ datasetId, kind, title }, context) => {
    const dataset = context.datasets.get(datasetId);
    if (!dataset) throw new ToolError(`There is no dataset ${datasetId} in this conversation turn.`);
    context.emit({ type: "chart", chart: buildChart(dataset, kind, title) });
    return { shown: true };
  },
});
