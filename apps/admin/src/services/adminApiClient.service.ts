import type { ApiErrorBody, ApiValidationIssue } from "@/types/api.type";
import { adaptListEnvelope } from "@/utils/listEnvelope.util";

let currentCsrfToken: string | null = null;
let stepUpPrompt: (() => Promise<boolean>) | null = null;
const activityListeners = new Set<() => void>();
const sessionEndingCodes = new Set(["SESSION_EXPIRED", "SESSION_IDLE_TIMEOUT", "UNAUTHENTICATED"]);

export function rememberCsrfTokenForRequests(csrfToken: string | null): void {
  currentCsrfToken = csrfToken;
}

export function readCsrfTokenForRequests(): string | null {
  return currentCsrfToken;
}

export function registerStepUpPrompt(prompt: (() => Promise<boolean>) | null): void {
  stepUpPrompt = prompt;
}

export function subscribeToAdminActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}

export class AdminApiRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: readonly ApiValidationIssue[] = [],
  ) {
    super(message);
    this.name = "AdminApiRequestError";
  }
}

export type QueryValue = string | number | boolean | null | undefined | readonly string[];

export interface AdminApiRequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly query?: Record<string, QueryValue>;
  readonly body?: unknown;
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
  readonly expect?: "json" | "text" | "blob";
  readonly promptForStepUp?: boolean;
}

export function buildQueryString(query: AdminApiRequestOptions["query"]): string {
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

function redirectToSignedOutPage(code: string): void {
  if (typeof window === "undefined") return;
  const nextPath = `${window.location.pathname}${window.location.search}`;
  const reason = code === "SESSION_IDLE_TIMEOUT" ? "idle" : "expired";
  window.location.assign(`/bff/auth/signed-out?reason=${reason}&next=${encodeURIComponent(nextPath)}`);
}

async function sendOnce(url: string, options: AdminApiRequestOptions): Promise<Response> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET" && currentCsrfToken) headers["X-CSRF-Token"] = currentCsrfToken;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  try {
    return await fetch(url, { method, headers, body, credentials: "same-origin", cache: "no-store", signal: options.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminApiRequestError(0, "NETWORK_UNAVAILABLE", "You appear to be offline. Check your connection and try again.");
  }
}

export async function sendRequestToAdminConsoleServer<Payload>(bffPath: string, options: AdminApiRequestOptions = {}): Promise<Payload> {
  const url = `${bffPath}${buildQueryString(options.query)}`;
  for (const listener of activityListeners) listener();
  let response = await sendOnce(url, options);
  let errorBody = response.ok ? null : ((await response.json().catch(() => null)) as ApiErrorBody | null);
  if (response.status === 403 && errorBody?.code === "STEP_UP_REQUIRED" && options.promptForStepUp !== false && stepUpPrompt) {
    const confirmed = await stepUpPrompt();
    if (!confirmed) throw new AdminApiRequestError(403, "STEP_UP_CANCELLED", "Action cancelled. Nothing was changed.");
    response = await sendOnce(url, options);
    errorBody = response.ok ? null : ((await response.json().catch(() => null)) as ApiErrorBody | null);
  }
  if (!response.ok) {
    if (response.status === 401 && errorBody && sessionEndingCodes.has(errorBody.code)) redirectToSignedOutPage(errorBody.code);
    throw new AdminApiRequestError(response.status, errorBody?.code ?? `HTTP_${response.status}`, errorBody?.message ?? "Something went wrong. Try again.", errorBody?.issues ?? []);
  }
  if (response.status === 204) return undefined as Payload;
  if (options.expect === "text") return (await response.text()) as Payload;
  if (options.expect === "blob") return (await response.blob()) as Payload;
  return adaptListEnvelope((await response.json()) as Payload);
}

export function sendAdminApiRequest<Payload>(apiPath: string, options: AdminApiRequestOptions = {}): Promise<Payload> {
  return sendRequestToAdminConsoleServer<Payload>(`/bff${apiPath}`, options);
}

export function readErrorMessageForDisplay(error: unknown): string {
  if (error instanceof AdminApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
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
