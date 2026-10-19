import styles from "./SegmentedControl.module.css";

export type SegmentOption<Value extends string> = {
  value: Value;
  label: string;
  /** Text color when selected, e.g. purple for income. */
  activeColor?: string;
};

type Props<Value extends string> = {
  label: string;
  /** Show the label above the buttons, or keep it for screen readers only. */
  showLabel?: boolean;
  options: readonly SegmentOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
};

/** A row of toggle buttons where exactly one is pressed. */
export function SegmentedControl<Value extends string>(props: Props<Value>) {
  const { label, showLabel = false, options, value, onChange } = props;
  return (
    <fieldset className={styles.fieldset}>
      <legend className={showLabel ? styles.legend : "visually-hidden"}>{label}</legend>
      <div className={styles.group}>
        {options.map((option) => {
          const pressed = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              className={styles.segment}
              style={pressed && option.activeColor ? { color: option.activeColor } : undefined}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
