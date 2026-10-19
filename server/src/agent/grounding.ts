// Checks that every dollar amount and percentage in an answer is a value a tool returned.
// The model does no arithmetic of its own (add_or_subtract does it), so nothing else is allowed.
// It costs no model call and catches made-up numbers.

export type GroundingReport = { grounded: boolean; unmatched: string[] };

const MONEY = /-?\$\s?\d[\d,]*(?:\.\d{1,2})?/g;
const PERCENT = /\d+(?:\.\d+)?%/g;

export function checkGrounding(answer: string, toolOutputs: readonly string[]): GroundingReport {
  const knownMoney = toolOutputs.flatMap(amountsIn);
  const knownPercents = toolOutputs.flatMap((output) => (output.match(PERCENT) ?? []).map(parsePercent));

  const unmatched = [
    ...(answer.match(MONEY) ?? []).filter((text) => !isKnown(Math.abs(parseMoney(text)), knownMoney, 0.01)),
    ...(answer.match(PERCENT) ?? []).filter((text) => !isKnown(parsePercent(text), knownPercents, 1)),
  ];
  return { grounded: unmatched.length === 0, unmatched };
}

function isKnown(value: number, known: readonly number[], tolerance: number): boolean {
  return known.some((candidate) => Math.abs(Math.abs(candidate) - value) <= tolerance);
}

/** Every dollar amount written in a piece of text, such as a tool result. */
export function amountsIn(text: string): number[] {
  return (text.match(MONEY) ?? []).map(parseMoney);
}

function parseMoney(text: string): number {
  return Number(text.replace(/[$,\s]/g, ""));
}

function parsePercent(text: string): number {
  return Number(text.replace("%", ""));
}
