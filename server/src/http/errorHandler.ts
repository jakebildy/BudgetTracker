// Turns any thrown error into the shared ApiErrorBody shape.
import type { ApiErrorBody } from "@budget/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../errors";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json(errorBody(error.code, error.message, error.fields));
    return;
  }
  if (isBodyParserError(error)) {
    const tooLarge = error.type === "entity.too.large";
    response
      .status(tooLarge ? 413 : 400)
      .json(
        errorBody(
          "validation_failed",
          tooLarge ? "The request is too large." : "The request body is not valid JSON.",
        ),
      );
    return;
  }
  console.error(error);
  response.status(500).json(errorBody("internal_error", "Something went wrong on our side."));
};

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json(errorBody("not_found", `No route for ${request.method} ${request.path}.`));
};

function errorBody(
  code: ApiErrorBody["error"]["code"],
  message: string,
  fields?: Record<string, string[]>,
): ApiErrorBody {
  return { error: { code, message, ...(fields && { fields }) } };
}

function isBodyParserError(error: unknown): error is { type: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof error.type === "string" &&
    error.type.startsWith("entity.")
  );
}
