import type { ApiErrorBody, ApiValidationIssue } from "@/types/api.type";
import { adaptListEnvelope } from "@/utils/listEnvelope.util";

let currentCsrfToken: string | null = null;

export function rememberCsrfTokenForRequests(csrfToken: string | null): void {
  currentCsrfToken = csrfToken;
}

export function readCsrfTokenForRequests(): string | null {
  return currentCsrfToken;
}

export class AdsApiRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: readonly ApiValidationIssue[] = [],
  ) {
    super(message);
    this.name = "AdsApiRequestError";
  }
}

export type QueryValue = string | number | boolean | null | undefined | readonly string[];

export interface AdsApiRequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly query?: Record<string, QueryValue>;
  readonly body?: unknown;
  readonly rawBody?: BodyInit;
  readonly headers?: Record<string, string>;
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
  readonly expect?: "json" | "text" | "blob";
}

export function buildQueryString(query: AdsApiRequestOptions["query"]): string {
  const searchParams = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) searchParams.set(name, value.join(","));
      continue;
    }
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

export async function sendRequestToAdsManagerServer<Payload>(bffPath: string, options: AdsApiRequestOptions = {}): Promise<Payload> {
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
    throw new AdsApiRequestError(0, "NETWORK_UNAVAILABLE", "You appear to be offline. Check your connection and try again.");
  }
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    if (response.status === 401 && (errorBody?.code === "SESSION_EXPIRED" || errorBody?.code === "UNAUTHENTICATED")) redirectToLoginAfterSessionEnded();
    throw new AdsApiRequestError(response.status, errorBody?.code ?? `HTTP_${response.status}`, errorBody?.message ?? "Something went wrong. Try again.", errorBody?.issues ?? []);
  }
  if (response.status === 204) return undefined as Payload;
  if (options.expect === "text") return (await response.text()) as Payload;
  if (options.expect === "blob") return (await response.blob()) as Payload;
  return adaptListEnvelope((await response.json()) as Payload);
}

export function sendAdsApiRequest<Payload>(apiPath: string, options: AdsApiRequestOptions = {}): Promise<Payload> {
  return sendRequestToAdsManagerServer<Payload>(`/bff${apiPath}`, options);
}

export function buildAccountApiPath(accountId: string, resourcePath = ""): string {
  return `/ads/accounts/${encodeURIComponent(accountId)}${resourcePath}`;
}

export function readErrorMessageForDisplay(error: unknown): string {
  if (error instanceof AdsApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

export function saveBlobAsDownloadedFile(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
