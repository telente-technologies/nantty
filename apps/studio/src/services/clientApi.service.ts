import { parseRetryAfterHeader, readFriendlyErrorMessage, readRequestIdHeader } from "@zudomart/web-kit";

export interface ApiErrorBody {
  readonly message: string;
  readonly code?: string;
  readonly issues?: readonly { readonly path?: readonly string[]; readonly message: string }[];
  readonly details?: Readonly<Record<string, unknown>>;
}

let currentCsrfToken: string | null = null;

export function rememberCsrfTokenForRequests(csrfToken: string | null): void {
  currentCsrfToken = csrfToken;
}

export class StudioRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Readonly<Record<string, unknown>>,
    public readonly requestId?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "StudioRequestError";
  }

  public get isNetworkFailure(): boolean {
    return this.status === 0;
  }
}

export interface StudioRequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly query?: Record<string, string | number | boolean | null | undefined>;
  readonly body?: unknown;
  readonly idempotencyKey?: string;
  readonly stepUpToken?: string;
  readonly signal?: AbortSignal;
}

export function buildQueryString(query: StudioRequestOptions["query"]): string {
  const searchParams = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(name, String(value));
  }
  const searchParamsText = searchParams.toString();
  return searchParamsText ? `?${searchParamsText}` : "";
}

function redirectToLoginAfterSessionEnded(): void {
  if (typeof window === "undefined") return;
  const nextPath = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(nextPath)}`);
}

export async function sendRequestToStudioServer<Payload>(apiPath: string, options: StudioRequestOptions = {}): Promise<Payload> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET" && currentCsrfToken) headers["X-CSRF-Token"] = currentCsrfToken;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.stepUpToken) headers["X-Step-Up-Token"] = options.stepUpToken;
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`/bff${apiPath}${buildQueryString(options.query)}`, {
      method,
      headers,
      body,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new StudioRequestError(0, "NETWORK_UNAVAILABLE", "You appear to be offline. Check your connection and try again.");
  }

  if (response.status === 401) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    if (errorBody?.code === "SESSION_EXPIRED" || errorBody?.code === "UNAUTHENTICATED" || errorBody?.code === "UNAUTHORIZED") redirectToLoginAfterSessionEnded();
    throw new StudioRequestError(401, errorBody?.code ?? "UNAUTHENTICATED", errorBody?.message ?? "Sign in to continue.", undefined, readRequestIdHeader(response.headers));
  }
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new StudioRequestError(response.status, errorBody?.code ?? `HTTP_${response.status}`, errorBody?.message ?? "That didn't work. Try again.", errorBody?.details, readRequestIdHeader(response.headers), parseRetryAfterHeader(response.headers.get("retry-after")));
  }
  if (response.status === 204) return undefined as Payload;
  return (await response.json()) as Payload;
}

export function createIdempotencyKey(prefix = "idem"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function readErrorMessageForDisplay(error: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "You're offline. Check your data or Wi-Fi and we'll retry when you're back.";
  return readFriendlyErrorMessage(error);
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof StudioRequestError && error.status === 404;
}

export function isNetworkFailureError(error: unknown): boolean {
  return error instanceof StudioRequestError && error.isNetworkFailure;
}

export function isRetryableApiFailure(error: unknown): boolean {
  if (isNetworkFailureError(error)) return true;
  return error instanceof StudioRequestError && (error.status === 408 || error.status === 429 || error.status >= 500);
}
