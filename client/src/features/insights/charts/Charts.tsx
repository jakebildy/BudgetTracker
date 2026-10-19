// Small charts for Ask AI answers, drawn with plain elements. Each has a text
// alternative listing every value, so screen readers get the same information.
import type {
  BarChart as BarSpec,
  ChartSpec,
  ColumnChart as ColumnSpec,
  PieChart as PieSpec,
} from "@budget/shared";
import { categoryColors } from "../../../lib/categoryColors";
import { formatMoney } from "../../../lib/format";
import styles from "./Charts.module.css";

export function Chart({ chart }: { chart: ChartSpec }) {
  switch (chart.kind) {
    case "bar":
      return <BarChart chart={chart} />;
    case "column":
      return <ColumnChart chart={chart} />;
    case "pie":
      return <PieChart chart={chart} />;
  }
}

function Frame({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <figure role="img" aria-label={`${title}: ${label}`} className={styles.frame}>
      <figcaption className={styles.title}>{title}</figcaption>
      {children}
    </figure>
  );
}

function BarChart({ chart }: { chart: BarSpec }) {
  const max = Math.max(...chart.items.map((item) => item.value), 1);
  return (
    <Frame
      title={chart.title}
      label={chart.items.map((item) => `${item.label} ${item.valueLabel}`).join(", ")}
    >
      {chart.items.map((item) => (
        <div key={item.label} className={styles.barRow}>
          <div className={styles.barLabels}>
            <span>{item.label}</span>
            <span className={styles.value}>{item.valueLabel}</span>
          </div>
          <div className={styles.barTrack}>
            <div
              className={styles.bar}
              style={{
                width: `${Math.max(2, Math.round((item.value / max) * 100))}%`,
                background: item.category ? categoryColors(item.category).mark : "var(--color-brand)",
              }}
            />
          </div>
        </div>
      ))}
    </Frame>
  );
}

function ColumnChart({ chart }: { chart: ColumnSpec }) {
  const max = Math.max(...chart.groups.flatMap((group) => [group.income, group.expense]), 1);
  const height = (value: number) => `${Math.max(2, Math.round((value / max) * 120))}px`;
  const label = chart.groups
    .map(
      (group) => `${group.label} income ${formatMoney(group.income)}, expenses ${formatMoney(group.expense)}`,
    )
    .join("; ");

  return (
    <Frame title={chart.title} label={label}>
      <div className={styles.columns}>
        {chart.groups.map((group) => (
          <div key={group.label} className={styles.columnGroup}>
            <div
              className={styles.column}
              style={{ height: height(group.income), background: "var(--color-income)" }}
            />
            <div
              className={styles.column}
              style={{ height: height(group.expense), background: "var(--color-expense-mark)" }}
            />
          </div>
        ))}
      </div>
      <div className={styles.columnLabels}>
        {chart.groups.map((group) => (
          <span key={group.label}>{group.label}</span>
        ))}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: "var(--color-income)" }} />
          Income
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: "var(--color-expense-mark)" }} />
          Expenses
        </span>
      </div>
    </Frame>
  );
}

function PieChart({ chart }: { chart: PieSpec }) {
  const label = chart.slices
    .map((slice) => `${slice.label} ${slice.valueLabel} (${Math.round(slice.share * 100)}%)`)
    .join(", ");
  const startOf = (index: number) =>
    chart.slices.slice(0, index).reduce((total, slice) => total + slice.share, 0);

  return (
    <Frame title={chart.title} label={label}>
      <div className={styles.pieLayout}>
        <svg viewBox="-1.04 -1.04 2.08 2.08" className={styles.pie} aria-hidden="true">
          {chart.slices.map((slice, index) => {
            const path = slicePath(startOf(index), startOf(index) + slice.share);
            return (
              <path
                key={slice.label}
                d={path}
                fill={categoryColors(slice.category ?? "Other").mark}
                stroke="#fff"
                strokeWidth={0.02}
              />
            );
          })}
        </svg>
        <ul className={styles.pieLegend}>
          {chart.slices.map((slice) => (
            <li key={slice.label} className={styles.pieRow}>
              <span
                className={styles.swatch}
                style={{ background: categoryColors(slice.category ?? "Other").mark }}
              />
              <span className={styles.pieName} title={slice.label}>
                {slice.label}
              </span>
              <span className={styles.pieAmount}>{slice.valueLabel}</span>
              <span className={styles.pieShare}>{Math.round(slice.share * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

/** SVG path for a pie slice between two fractions of a full turn, starting at 12 o'clock. */
function slicePath(fromFraction: number, toFraction: number): string {
  if (toFraction - fromFraction >= 0.9999) return "M 0 -1 A 1 1 0 1 1 0 1 A 1 1 0 1 1 0 -1 Z";
  const point = (fraction: number) => {
    const angle = 2 * Math.PI * fraction - Math.PI / 2;
    return `${Math.cos(angle)} ${Math.sin(angle)}`;
  };
  const largeArc = toFraction - fromFraction > 0.5 ? 1 : 0;
  return `M 0 0 L ${point(fromFraction)} A 1 1 0 ${largeArc} 1 ${point(toFraction)} Z`;
}
