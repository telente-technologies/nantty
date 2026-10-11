import { useAuthPromptStore } from "@/components/auth/authPrompt.store";
import { useHumanVerificationStore } from "@/components/security/humanVerification.store";
import { describeLimitError } from "@/utils/limitErrors.util";
import { decideSessionExpiredAction } from "@/utils/sessionExpiry.util";

export interface ApiErrorBody {
  readonly message: string;
  readonly code?: string;
  readonly suggestions?: readonly string[];
  readonly details?: Readonly<Record<string, unknown>>;
  readonly issues?: readonly { readonly path?: readonly string[]; readonly message: string }[];
}

let currentCsrfToken: string | null = null;

export function rememberCsrfTokenForRequests(csrfToken: string | null): void {
  currentCsrfToken = csrfToken;
}

export function readCsrfTokenForRequests(): string | null {
  return currentCsrfToken;
}

export class WebappRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly suggestions?: readonly string[],
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(describeLimitError(code, details) ?? message);
    this.name = "WebappRequestError";
  }

  public get isNetworkFailure(): boolean {
    return this.status === 0;
  }
}

export interface WebappRequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly query?: Record<string, string | number | boolean | null | undefined>;
  readonly body?: unknown;
  readonly idempotencyKey?: string;
  readonly stepUpToken?: string;
  readonly signal?: AbortSignal;
  readonly skipHumanVerification?: boolean;
}

export function buildQueryString(query: WebappRequestOptions["query"]): string {
  const searchParams = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(name, String(value));
  }
  const searchParamsText = searchParams.toString();
  return searchParamsText ? `?${searchParamsText}` : "";
}

function promptSignInAfterUnauthenticatedResponse(): void {
  if (typeof window === "undefined") return;
  useAuthPromptStore.getState().openAuthPrompt("Sign in to continue. Anything you were doing will pick up where you left off.");
}

let isLeavingForSignIn = false;

function handleExpiredSession(): void {
  if (typeof window === "undefined" || isLeavingForSignIn) return;
  const action = decideSessionExpiredAction(window.location.pathname, window.location.search);
  if (action.kind === "prompt") {
    promptSignInAfterUnauthenticatedResponse();
    return;
  }
  isLeavingForSignIn = true;
  window.location.assign(action.href);
}

export async function sendRequestToWebappServer<Payload>(apiPath: string, options: WebappRequestOptions = {}): Promise<Payload> {
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
    throw new WebappRequestError(0, "NETWORK_UNAVAILABLE", "You appear to be offline. Check your connection and try again.");
  }

  if (response.status === 401) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    if (errorBody?.code === "SESSION_EXPIRED") handleExpiredSession();
    else if (method !== "GET" && errorBody?.code === "UNAUTHENTICATED") promptSignInAfterUnauthenticatedResponse();
    throw new WebappRequestError(401, errorBody?.code ?? "UNAUTHENTICATED", errorBody?.message ?? "Sign in to continue.");
  }
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as (ApiErrorBody & { readonly reason?: string }) | null;
    if (response.status === 428 && errorBody?.code === "HUMAN_VERIFICATION_REQUIRED" && options.skipHumanVerification !== true && typeof window !== "undefined") {
      const passed = await useHumanVerificationStore.getState().requestHumanVerification(errorBody.reason ?? "security_check");
      if (passed) return sendRequestToWebappServer<Payload>(apiPath, { ...options, skipHumanVerification: true });
    }
    throw new WebappRequestError(response.status, errorBody?.code ?? `HTTP_${response.status}`, errorBody?.message ?? "Something went wrong. Try again.", errorBody?.suggestions, errorBody?.details);
  }
  if (response.status === 204) return undefined as Payload;
  return (await response.json()) as Payload;
}

export async function sendListRequestToWebappServer<Item>(apiPath: string, options: WebappRequestOptions = {}): Promise<Item[]> {
  const payload = await sendRequestToWebappServer<Item[] | { readonly data?: readonly Item[] }>(apiPath, options);
  return Array.isArray(payload) ? payload : [...(payload?.data ?? [])];
}

export function createIdempotencyKey(prefix = "idem"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function readErrorMessageForDisplay(error: unknown): string {
  if (error instanceof WebappRequestError) return error.message;
  if (error instanceof Error && error.name !== "AbortError") return "Something went wrong. Try again.";
  return "Something went wrong. Try again.";
}

export function isSignInRequiredError(error: unknown): boolean {
  return error instanceof WebappRequestError && error.status === 401 && (error.code === "UNAUTHENTICATED" || error.code === "SESSION_EXPIRED");
}

export function isNetworkFailureError(error: unknown): boolean {
  return error instanceof WebappRequestError && error.isNetworkFailure;
}

export function isRetryableApiFailure(error: unknown): boolean {
  if (isNetworkFailureError(error)) return true;
  return error instanceof WebappRequestError && (error.status === 408 || error.status === 429 || error.status >= 500);
}
