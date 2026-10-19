// A one-line record of the tool calls behind an answer. The client sends it back
// with that answer in later history, so the model can see its earlier figures came
// from tools. Without it, the model reads its own past numbers as unsupported.
import type { ToolCallTrace } from "./harness";

const MAX_LENGTH = 600;

export function toolNote(calls: readonly ToolCallTrace[]): string | null {
  if (calls.length === 0) return null;
  const described = [...new Set(calls.map(describeCall))];
  const note = `Looked up with: ${described.join("; ")}`;
  return note.length > MAX_LENGTH ? `${note.slice(0, MAX_LENGTH - 1)}…` : note;
}

function describeCall(call: ToolCallTrace): string {
  const inputs = typeof call.input === "object" && call.input !== null ? Object.entries(call.input) : [];
  const args = inputs
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${describeValue(value)}`)
    .join(", ");
  return `${call.name}(${args})${call.isError ? " failed" : ""}`;
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.every((item) => typeof item !== "object") ? value.join("|") : `${value.length} items`;
  }
  return typeof value === "object" ? "{…}" : String(value);
}
