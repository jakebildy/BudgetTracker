// Builds chart specs from stored datasets, and refuses chart types that would mislead.
import { type ChartKind, type ChartSpec, formatDollars } from "@budget/shared";
import type { Dataset } from "./datasets";
import { ToolError } from "./tools/defineTool";

const MAX_PIE_SLICES = 6;

export function buildChart(dataset: Dataset, kind: ChartKind, title: string): ChartSpec {
  switch (kind) {
    case "column":
      if (dataset.kind !== "monthly_totals") {
        throw new ToolError("Column charts compare income and expenses by month. Use a get_summary dataset.");
      }
      return {
        kind,
        title,
        groups: dataset.rows.map((row) => ({
          label: monthName(row.month, false),
          income: row.totalIncome,
          expense: row.totalExpenses,
        })),
      };

    case "bar":
      if (dataset.kind !== "grouped_sum") {
        throw new ToolError("Bar charts need a sum_transactions dataset grouped by month or category.");
      }
      return {
        kind,
        title,
        items: dataset.groups.map((group) => ({
          label: dataset.groupBy === "month" ? monthName(group.key, true) : group.key,
          value: group.total,
          valueLabel: formatDollars(group.total),
          ...(dataset.groupBy === "category" && { category: group.key }),
        })),
      };

    case "pie":
      return buildPie(dataset, title);
  }
}

/** Pie charts only show how one total splits across categories. */
function buildPie(dataset: Dataset, title: string): ChartSpec {
  if (dataset.kind !== "grouped_sum" || dataset.groupBy !== "category") {
    throw new ToolError("Pie charts need a sum_transactions dataset grouped by category. Try a bar chart.");
  }
  if (dataset.groups.length < 2 || dataset.groups.some((group) => group.total <= 0)) {
    throw new ToolError("A pie chart needs at least two positive categories. Try a bar chart.");
  }
  const sorted = [...dataset.groups].sort((a, b) => b.total - a.total);
  const kept = sorted.slice(0, MAX_PIE_SLICES - 1);
  const rest = sorted.slice(MAX_PIE_SLICES - 1);
  const slices = rest.length > 1 ? [...kept, mergeGroups(rest)] : sorted;
  const total = slices.reduce((sum, group) => sum + group.total, 0);

  return {
    kind: "pie",
    title,
    slices: slices.map((group) => ({
      label: group.key,
      value: group.total,
      valueLabel: formatDollars(group.total),
      share: group.total / total,
      category: group.key,
    })),
  };
}

function mergeGroups(groups: { key: string; total: number; count: number }[]) {
  return {
    key: "Everything else",
    total: Math.round(groups.reduce((sum, group) => sum + group.total * 100, 0)) / 100,
    count: groups.reduce((sum, group) => sum + group.count, 0),
  };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthName(month: string, full: boolean): string {
  const name = MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
  return full ? name : name.slice(0, 3);
}
