import { parseRetryAfterHeader, readFriendlyErrorMessage, readRequestIdHeader } from "@nantty/web-kit";

import type { ApiErrorBody, ApiValidationIssue } from "@/types/api.type";
import { adaptListEnvelope } from "@/utils/listEnvelope.util";
import { describeLimitError } from "@/utils/limitErrors.util";

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
    public readonly details?: Readonly<Record<string, unknown>>,
    public readonly requestId?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(describeLimitError(code, details) ?? message);
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
  readonly stepUpToken?: string;
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

export const verificationRequiredErrorCode = "VERIFICATION_REQUIRED";
export const verificationRequiredEventName = "zudomart-ads:verification-required";

function announceVerificationRequired(message: string | undefined): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(verificationRequiredEventName, { detail: { message: message ?? null } }));
}

export function isVerificationRequiredError(error: unknown): error is AdsApiRequestError {
  return error instanceof AdsApiRequestError && error.status === 403 && error.code === verificationRequiredErrorCode;
}

const sessionEndedErrorCodes = new Set(["SESSION_EXPIRED", "UNAUTHENTICATED", "UNAUTHORIZED"]);
const genericValidationMessage = "Validation failed";

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
  if (options.stepUpToken) headers["X-Step-Up-Token"] = options.stepUpToken;
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
    if (response.status === 401 && sessionEndedErrorCodes.has(errorBody?.code ?? "")) redirectToLoginAfterSessionEnded();
    if (response.status === 403 && errorBody?.code === verificationRequiredErrorCode) announceVerificationRequired(errorBody.message);
    throw new AdsApiRequestError(response.status, errorBody?.code ?? `HTTP_${response.status}`, errorBody?.message ?? "That didn't work. Try again.", errorBody?.issues ?? [], errorBody?.details, readRequestIdHeader(response.headers), parseRetryAfterHeader(response.headers.get("retry-after")));
  }
  if (response.status === 204) return undefined as Payload;
  if (options.expect === "text") return (await response.text()) as Payload;
  if (options.expect === "blob") return (await response.blob()) as Payload;
  return adaptListEnvelope((await response.json()) as Payload);
}

const mutationsInFlight = new Map<string, Promise<unknown>>();

function describeMutation(apiPath: string, options: AdsApiRequestOptions): string | null {
  const method = options.method ?? "GET";
  if (method === "GET" || options.rawBody !== undefined) return null;
  return `${method} ${apiPath}${buildQueryString(options.query)} ${options.body === undefined ? "" : JSON.stringify(options.body)}`;
}

export function sendAdsApiRequest<Payload>(apiPath: string, options: AdsApiRequestOptions = {}): Promise<Payload> {
  const mutationKey = describeMutation(apiPath, options);
  if (mutationKey === null) return sendRequestToAdsManagerServer<Payload>(`/bff${apiPath}`, options);
  const pending = mutationsInFlight.get(mutationKey);
  if (pending) return pending as Promise<Payload>;
  const request = sendRequestToAdsManagerServer<Payload>(`/bff${apiPath}`, options).finally(() => mutationsInFlight.delete(mutationKey));
  mutationsInFlight.set(mutationKey, request);
  return request;
}

export function buildAccountApiPath(accountId: string, resourcePath = ""): string {
  return `/ads/accounts/${encodeURIComponent(accountId)}${resourcePath}`;
}

export function readErrorMessageForDisplay(error: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "You're offline. Check your connection and we'll retry when you're back.";
  if (error instanceof AdsApiRequestError && error.message === genericValidationMessage && error.issues[0]) return error.issues[0].message;
  return readFriendlyErrorMessage(error);
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

export const stepUpRequiredErrorCodes: readonly string[] = ["STEP_UP_REQUIRED", "STEP_UP_REUSED"];

export function isStepUpRequiredError(error: unknown): error is AdsApiRequestError {
  return error instanceof AdsApiRequestError && stepUpRequiredErrorCodes.includes(error.code);
}

export async function grantStepUpWithPassword(password: string): Promise<string> {
  const granted = await sendRequestToAdsManagerServer<{ readonly stepUpToken: string }>("/bff/auth/step-up", { method: "POST", body: { password } });
  return granted.stepUpToken;
}
