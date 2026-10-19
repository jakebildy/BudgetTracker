import type { z } from "zod";
import { ValidationError } from "./errors";

/** Parses untrusted input with a Zod schema, throwing a ValidationError the API can return as-is. */
export function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data;
}
