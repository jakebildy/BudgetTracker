// Converts a Zod schema to the JSON Schema subset the model API accepts for strict
// tool inputs and structured outputs. Constraints the API can't enforce (min/max,
// lengths) are removed here; the Zod schema still enforces them after parsing.
import { z } from "zod";
import type { JsonSchema } from "./types";

const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "maxItems",
]);

export function toModelJsonSchema(schema: z.ZodType): JsonSchema {
  const converted = simplify(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }));
  if (!isObject(converted)) throw new Error("Tool and output schemas must be objects.");
  return converted;
}

function simplify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplify);
  if (!isObject(node)) return node;

  const result: JsonSchema = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    if (key === "minItems" && typeof value === "number" && value > 1) continue;
    result[key] = simplify(value);
  }
  if (result.type === "object") result.additionalProperties = false;
  return result;
}

function isObject(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
