// Results from read tools, kept for the rest of one agent run so render_chart can
// point at them by id. Charts are built from these, never from numbers the model writes.
import type { TransactionType } from "@budget/shared";
import type { GroupTotal } from "../domain/totals";
import type { MonthlyTotals } from "../services/summaryService";

export type Dataset =
  | { kind: "monthly_totals"; rows: MonthlyTotals[] }
  | { kind: "grouped_sum"; groupBy: "month" | "category"; type: TransactionType; groups: GroupTotal[] };

export class DatasetStore {
  private readonly datasets = new Map<string, Dataset>();

  add(dataset: Dataset): string {
    const id = `ds_${this.datasets.size + 1}`;
    this.datasets.set(id, dataset);
    return id;
  }

  get(id: string): Dataset | undefined {
    return this.datasets.get(id);
  }
}
