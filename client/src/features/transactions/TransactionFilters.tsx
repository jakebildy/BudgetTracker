import { ALL_CATEGORIES, type Category, CategorySchema, type TransactionType } from "@budget/shared";
import { SearchIcon } from "../../components/icons";
import { SegmentedControl } from "../../components/SegmentedControl";
import styles from "./TransactionFilters.module.css";

export type Filters = {
  type: TransactionType | "all";
  category: Category | "all";
  search: string;
};

export const NO_FILTERS: Filters = { type: "all", category: "all", search: "" };

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "income", label: "Income", activeColor: "var(--color-income)" },
  { value: "expense", label: "Expense", activeColor: "var(--color-expense)" },
] as const;

type Props = { filters: Filters; onChange: (filters: Filters) => void };

export function TransactionFilters({ filters, onChange }: Props) {
  const hasFilters = filters.type !== "all" || filters.category !== "all" || filters.search.trim() !== "";

  return (
    <div className={styles.row}>
      <div className={styles.search}>
        <label htmlFor="search" className={styles.label}>
          Search description
        </label>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>
            <SearchIcon />
          </span>
          <input
            id="search"
            type="search"
            placeholder="e.g. groceries"
            className={styles.searchInput}
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
          />
        </div>
      </div>

      <SegmentedControl
        label="Type"
        showLabel
        options={TYPE_OPTIONS}
        value={filters.type}
        onChange={(type) => onChange({ ...filters, type })}
      />

      <div className={styles.category}>
        <label htmlFor="category-filter" className={styles.label}>
          Category
        </label>
        <select
          id="category-filter"
          className={styles.select}
          value={filters.category}
          onChange={(event) => onChange({ ...filters, category: toCategoryFilter(event.target.value) })}
        >
          <option value="all">All categories</option>
          {ALL_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <button type="button" className={styles.clear} onClick={() => onChange(NO_FILTERS)}>
          Clear filters
        </button>
      )}
    </div>
  );
}

function toCategoryFilter(value: string): Filters["category"] {
  const parsed = CategorySchema.safeParse(value);
  return parsed.success ? parsed.data : "all";
}
