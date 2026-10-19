// The only place the client talks to the network. Every request and response is typed from @budget/shared.
import type { ApiErrorBody } from "@budget/shared";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(body?.error.message ?? `Request failed with status ${status}.`);
    this.name = "ApiRequestError";
  }

  /** Field name to first message, for showing next to form inputs. */
  get fieldErrors(): Record<string, string> {
    const fields = this.body?.error.fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([field, messages]) => [field, messages[0] ?? ""]));
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
  signal?: AbortSignal;
};

/** Sends a request and returns the parsed JSON body. The server's contract is typed in @budget/shared. */
export async function request<Body>(path: string, options: RequestOptions = {}): Promise<Body> {
  const response = await send(path, options);
  return (await response.json()) as Body;
}

/** For endpoints that answer 204 No Content. */
export async function requestWithoutBody(path: string, options: RequestOptions = {}): Promise<void> {
  await send(path, options);
}

/** Like `request`, but returns the raw response so the caller can read a stream. */
export function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const init: RequestInit = { method: options.method ?? "GET" };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = { "content-type": "application/json" };
  }
  if (options.signal) init.signal = options.signal;

  return fetch(withQuery(path, options.query), init).then(async (response) => {
    if (!response.ok) throw new ApiRequestError(response.status, await readErrorBody(response));
    return response;
  });
}

function withQuery(path: string, query: RequestOptions["query"]): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}
