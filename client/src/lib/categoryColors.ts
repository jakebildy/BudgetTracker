// Category palette from the Plum design: a soft background, readable text, and a strong mark color.
type CategoryColors = { background: string; text: string; mark: string };

const OTHER: CategoryColors = { background: "#EEEDF2", text: "#4A4558", mark: "#98A2B3" };

const PALETTE: Record<string, CategoryColors> = {
  Food: { background: "#FDEBD3", text: "#8A4A0B", mark: "#F79009" },
  Housing: { background: "#E3E7FD", text: "#3A44A8", mark: "#6172F3" },
  Utilities: { background: "#FFF4C2", text: "#7A5C00", mark: "#EAAA08" },
  Transport: { background: "#D9F1F7", text: "#145E70", mark: "#2BA5C4" },
  Entertainment: { background: "#FBE0EF", text: "#9B2463", mark: "#EE46BC" },
  Health: { background: "#DDF5E6", text: "#1E6B3E", mark: "#32D583" },
  Shopping: { background: "#EEE3FC", text: "#5B2EA0", mark: "#9E77ED" },
  Salary: { background: "#DCF2EC", text: "#0F6A4E", mark: "#2DB28A" },
  Freelance: { background: "#E9F2D8", text: "#4C6A12", mark: "#86B33A" },
  Other: OTHER,
};

export function categoryColors(category: string): CategoryColors {
  return PALETTE[category] ?? OTHER;
}
