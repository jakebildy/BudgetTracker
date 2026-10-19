// Every error response from the API has this shape.

export type ApiErrorCode =
  | "validation_failed"
  | "not_found"
  | "conflict"
  | "ai_unavailable"
  | "internal_error";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field name to messages, for validation errors. */
    fields?: Record<string, string[]>;
  };
};
