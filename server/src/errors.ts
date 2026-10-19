// Errors that services throw on purpose. The error middleware turns each one
// into the shared ApiErrorBody shape with the right HTTP status.
import type { ApiErrorCode } from "@budget/shared";
import type { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("not_found", 404, message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string[]>) {
    super("validation_failed", 400, message, fields);
  }

  static fromZod(error: ZodError): ValidationError {
    const fields: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] = [...(fields[key] ?? []), issue.message];
    }
    return new ValidationError("Some fields are invalid.", fields);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("conflict", 409, message);
  }
}

export class AiUnavailableError extends AppError {
  constructor(message: string) {
    super("ai_unavailable", 503, message);
  }
}
