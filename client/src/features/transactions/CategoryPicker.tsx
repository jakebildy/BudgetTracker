import { type Category, categoriesFor, type Transaction } from "@budget/shared";
import { ChevronDownIcon } from "../../components/icons";
import { categoryColors } from "../../lib/categoryColors";
import styles from "./CategoryPicker.module.css";

type Props = {
  transaction: Transaction;
  /** The category to show, which may be a change still being saved. */
  value: Category;
  onChange: (category: Category) => void;
  disabled: boolean;
};

/**
 * The category pill in a table row, which is also a native select: tap it to recategorize.
 * A native select keeps keyboard and screen reader support, and phones open their own picker.
 */
export function CategoryPicker({ transaction, value, onChange, disabled }: Props) {
  const colors = categoryColors(value);
  const options = categoriesFor(transaction.type);
  return (
    <span className={styles.pill} style={{ background: colors.background, color: colors.text }}>
      <span aria-hidden="true" className={styles.dot} style={{ background: colors.mark }} />
      <select
        aria-label={`Category for ${transaction.description}`}
        className={styles.select}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const chosen = options.find((category) => category === event.target.value);
          if (chosen && chosen !== value) onChange(chosen);
        }}
      >
        {options.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className={styles.chevron}>
        <ChevronDownIcon />
      </span>
    </span>
  );
}
