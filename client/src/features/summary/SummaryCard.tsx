import type { SummaryResponse } from "@budget/shared";
import { useState } from "react";
import { categoryColors } from "../../lib/categoryColors";
import { formatBalance, formatMoney, monthShort } from "../../lib/format";
import styles from "./SummaryCard.module.css";

type Segment = { key: string; label: string; total: number; color: string; detail: string };

/**
 * Income and expenses as two bars on one scale, so the expense bar also shows how
 * much of the income was spent, with the net balance underneath. Expenses are split
 * by category in the tag colors.
 */
export function SummaryCard({ summary }: { summary: SummaryResponse | undefined }) {
  const income = summary?.totalIncome ?? 0;
  const expenses = summary?.totalExpenses ?? 0;
  const net = summary?.netBalance ?? 0;
  const scale = Math.max(income, expenses);

  const incomeSegments: Segment[] =
    income > 0
      ? [
          {
            key: "income",
            label: "Income",
            total: income,
            color: "var(--color-income)",
            detail: "total income",
          },
        ]
      : [];
  const expenseSegments: Segment[] = (summary?.expensesByCategory ?? []).map(({ category, total }) => ({
    key: category,
    label: category,
    total,
    color: categoryColors(category).mark,
    detail: `${Math.round((total / expenses) * 100)}% of expenses`,
  }));

  return (
    <section aria-label="Summary" className={styles.card}>
      <BarRow
        label="Income"
        amount={formatMoney(income)}
        amountClassName={styles.incomeAmount}
        comparison={comparison(summary, "totalIncome")}
        segments={incomeSegments}
        scale={scale}
      />
      <BarRow
        label="Expenses"
        amount={formatMoney(expenses)}
        amountClassName={styles.expenseAmount}
        comparison={comparison(summary, "totalExpenses")}
        segments={expenseSegments}
        scale={scale}
      />
      <hr className={styles.divider} />
      <BarRow
        label="Net balance"
        amount={formatBalance(net)}
        amountClassName={net < 0 ? styles.negativeAmount : styles.netAmount}
        comparison={comparison(summary, "netBalance")}
        segments={null}
        scale={scale}
      />
    </section>
  );
}

type BarRowProps = {
  label: string;
  amount: string;
  amountClassName: string | undefined;
  comparison: string;
  /** Null for a row that shows only the amount, without a bar. */
  segments: readonly Segment[] | null;
  scale: number;
};

function BarRow({ label, amount, amountClassName, comparison: change, segments, scale }: BarRowProps) {
  const [active, setActive] = useState<string | null>(null);
  const fillsTrack =
    scale > 0 && (segments ?? []).reduce((sum, segment) => sum + segment.total, 0) >= scale - 0.005;

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <p className={styles.label}>
          {label} <span className={styles.change}>{change}</span>
        </p>
        <p className={`${styles.amount} ${amountClassName ?? ""}`}>{amount}</p>
      </div>
      {segments && (
        <ul aria-label={`${label} breakdown`} className={`${styles.track} ${fillsTrack ? styles.full : ""}`}>
          {segments.map((segment) => (
            <li
              key={segment.key}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: focus shows the same tooltip as hover, for keyboard users.
              tabIndex={0}
              aria-label={`${segment.label}: ${formatMoney(segment.total)}, ${segment.detail}`}
              className={styles.segment}
              style={{ width: `${(segment.total / scale) * 100}%`, background: segment.color }}
              onMouseEnter={() => setActive(segment.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(segment.key)}
              onBlur={() => setActive(null)}
            >
              {active === segment.key && (
                <span role="tooltip" className={styles.tooltip}>
                  <strong>{segment.label}</strong> {formatMoney(segment.total)}
                  <span className={styles.tooltipDetail}>{segment.detail}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function comparison(
  summary: SummaryResponse | undefined,
  field: "totalIncome" | "totalExpenses" | "netBalance",
): string {
  if (!summary?.previous) return "First month on record";
  const difference = summary[field] - summary.previous[field];
  const previousLabel = monthShort(summary.previous.month);
  if (Math.abs(difference) < 0.005) return `Same as ${previousLabel}`;
  return `${difference > 0 ? "▲" : "▼"} ${formatMoney(Math.abs(difference))} vs ${previousLabel}`;
}
