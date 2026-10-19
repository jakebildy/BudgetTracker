import { SegmentedControl } from "../../components/SegmentedControl";
import { monthShort, monthTitle } from "../../lib/format";
import styles from "./MonthSwitcher.module.css";

const MAX_TABS = 6;

type Props = {
  /** Every month that can be shown, oldest first. */
  months: readonly string[];
  value: string;
  onChange: (month: string) => void;
};

/** Tabs for recent months, plus a list of every month once there are more than fit in the tabs. */
export function MonthSwitcher({ months, value, onChange }: Props) {
  const recent = months.slice(-MAX_TABS);
  const tabs = recent.includes(value) ? recent : [value, ...recent.slice(1)].sort();

  return (
    <div className={styles.switcher}>
      {months.length > MAX_TABS && (
        <div className={styles.picker}>
          <label htmlFor="month-picker" className="visually-hidden">
            Any month
          </label>
          <select
            id="month-picker"
            className={styles.select}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            {[...months].reverse().map((month) => (
              <option key={month} value={month}>
                {monthTitle(month)}
              </option>
            ))}
          </select>
        </div>
      )}
      <SegmentedControl
        label="Month"
        options={tabs.map((month) => ({ value: month, label: monthShort(month) }))}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
