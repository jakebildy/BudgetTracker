import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MonthSwitcher } from "./MonthSwitcher";

const YEAR = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

describe("MonthSwitcher", () => {
  it("keeps every month reachable once there are more than fit in the tabs", async () => {
    const onChange = vi.fn();
    render(<MonthSwitcher months={YEAR} value="2026-06" onChange={onChange} />);

    expect(screen.getAllByRole("button")).toHaveLength(6);
    await userEvent.selectOptions(screen.getByLabelText("Any month"), "2025-11");

    expect(onChange).toHaveBeenCalledWith("2025-11");
  });

  it("shows the selected month as a tab even when it is older than the recent ones", () => {
    render(<MonthSwitcher months={YEAR} value="2025-11" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Nov" })).toHaveAttribute("aria-pressed", "true");
  });
});
