import { isBrowserOffline } from "@zudomart/web-kit";

import { describeLimitError } from "@/utils/limitErrors.util";

import type { ApiErrorBody } from "@/types/pagination.type";

let currentCsrfToken: string | null = null;

export function rememberCsrfTokenForRequests(csrfToken: string | null): void {
  currentCsrfToken = csrfToken;
}

export class SellerApiRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: ApiErrorBody["issues"] = [],
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(describeLimitError(code, details) ?? message);
    this.name = "SellerApiRequestError";
  }

  public get isNetworkFailure(): boolean {
    return this.status === 0;
  }
}

export interface SellerApiRequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly query?: Record<string, string | number | boolean | null | undefined>;
  readonly body?: unknown;
  readonly rawBody?: BodyInit;
  readonly headers?: Record<string, string>;
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
  readonly expect?: "json" | "text" | "blob";
}

export function buildQueryString(query: SellerApiRequestOptions["query"]): string {
  const searchParams = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(name, String(value));
  }
  const queryText = searchParams.toString();
  return queryText ? `?${queryText}` : "";
}

function redirectToLoginAfterSessionEnded(): void {
  if (typeof window === "undefined") return;
  const nextPath = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(nextPath)}`);
}

export async function sendRequestToDashboardServer<Payload>(bffPath: string, options: SellerApiRequestOptions = {}): Promise<Payload> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (method !== "GET" && currentCsrfToken) headers["X-CSRF-Token"] = currentCsrfToken;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  let body: BodyInit | undefined = options.rawBody;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  let response: Response;
  try {
    response = await fetch(`${bffPath}${buildQueryString(options.query)}`, { method, headers, body, credentials: "same-origin", cache: "no-store", signal: options.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new SellerApiRequestError(0, "NETWORK_UNAVAILABLE", "You appear to be offline. Check your connection and try again.");
  }
  if (response.status === 401) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    if (errorBody?.code === "SESSION_EXPIRED" || errorBody?.code === "UNAUTHENTICATED") redirectToLoginAfterSessionEnded();
    throw new SellerApiRequestError(401, errorBody?.code ?? "UNAUTHENTICATED", errorBody?.message ?? "Sign in to continue.");
  }
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new SellerApiRequestError(response.status, errorBody?.code ?? `HTTP_${response.status}`, errorBody?.message ?? "Something went wrong. Try again.", errorBody?.issues ?? [], errorBody?.details);
  }
  if (response.status === 204) return undefined as Payload;
  if (options.expect === "text") return (await response.text()) as Payload;
  if (options.expect === "blob") return (await response.blob()) as Payload;
  return (await response.json()) as Payload;
}

const mutationsInFlight = new Map<string, Promise<unknown>>();

function describeMutation(apiPath: string, options: SellerApiRequestOptions): string | null {
  const method = options.method ?? "GET";
  if (method === "GET" || options.rawBody !== undefined) return null;
  return `${method} ${apiPath}${buildQueryString(options.query)} ${options.body === undefined ? "" : JSON.stringify(options.body)}`;
}

export function sendSellerApiRequest<Payload>(apiPath: string, options: SellerApiRequestOptions = {}): Promise<Payload> {
  const mutationKey = describeMutation(apiPath, options);
  if (mutationKey === null) return sendRequestToDashboardServer<Payload>(`/bff${apiPath}`, options);
  const pending = mutationsInFlight.get(mutationKey);
  if (pending) return pending as Promise<Payload>;
  const request = sendRequestToDashboardServer<Payload>(`/bff${apiPath}`, options).finally(() => mutationsInFlight.delete(mutationKey));
  mutationsInFlight.set(mutationKey, request);
  return request;
}

export function createIdempotencyKey(prefix = "idem"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function readErrorMessageForDisplay(error: unknown): string {
  if (isBrowserOffline()) return "You're offline. Check your connection and we'll retry when you're back.";
  if (error instanceof SellerApiRequestError) return error.message;
  if (error instanceof Error && error.name !== "AbortError") return "Something went wrong. Try again.";
  return "Something went wrong. Try again.";
}
