import { apiConfig, shouldUseMockForPath } from "@/config/api.config";
import { resolveMockApiRequest } from "@/mocks";
import { useAuthStore } from "@/store/auth.store";
import { useLocaleStore } from "@/store/locale.store";
import { usePendingAuthIntentStore } from "@/store/pendingAuthIntent.store";

import { ApiError } from "@/errors/api.error";
import type { Page } from "@/types";
import { isBackgroundCallSkippedForGuests } from "@/config/guestAccess.config";
import { readStoreBillingRequestHeaders } from "./storeBilling.service";
import { runHumanVerificationInAppBrowser } from "./humanVerification.service";

export { ApiError };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  readonly body?: unknown;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly idempotencyKey?: string;
  readonly auth?: boolean;
  readonly headers?: Record<string, string>;
}

const appendQueryStringToPath = (path: string, query?: RequestOptions["query"]) => {
  const entries = Object.entries(query ?? {}).filter(([, v]) => v !== undefined) as [string, string | number | boolean][];
  if (entries.length === 0) return path;
  return `${path}?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")}`;
};

export const unwrapApiPayload = <T>(payload: unknown): T => {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return payload as T;
  const record = payload as { data?: unknown };
  if ("nextCursor" in record) return payload as T;
  return (record.data ?? payload) as T;
};

let refreshing: Promise<boolean> | null = null;

async function refreshAccessTokenWithRefreshToken(): Promise<boolean> {
  const { refreshToken, replaceSessionTokens, clearSessionAndSignOut } = useAuthStore.getState();
  if (!refreshToken) return false;
  try {
    const tokens = await sendHttpRequest<{ accessToken: string; refreshToken: string }>("POST", "/api/v1/auth/refresh", {
      body: { refreshToken },
      auth: false,
    });
    await replaceSessionTokens(tokens);
    return true;
  } catch {
    await clearSessionAndSignOut();
    return false;
  }
}

async function sendHttpRequest<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const url = appendQueryStringToPath(path, options.query);
  if (shouldUseMockForPath(path)) return resolveMockApiRequest<T>(method, url, options.body, options.idempotencyKey, !useAuthStore.getState().accessToken);

  const headers: Record<string, string> = { Accept: "application/json", ...getAuthorizedRequestHeaders(options.auth !== false) };
  if (method !== "GET") delete headers["X-Client-Region"];
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  Object.assign(headers, options.headers);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), apiConfig.timeoutMs);
  try {
    const response = await fetch(`${apiConfig.baseUrl}${url}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = (payload ?? {}) as { message?: string; code?: string; suggestions?: string[]; details?: Record<string, unknown> };
      throw new ApiError(response.status, error.message ?? "Something went wrong", error.code, error.suggestions, error.details);
    }
    return unwrapApiPayload<T>(payload);
  } finally {
    clearTimeout(timer);
  }
}

export function getAuthorizedRequestHeaders(includeAuthorization = true): Record<string, string> {
  const headers: Record<string, string> = {};
  const deviceRegionCode = useLocaleStore.getState().deviceRegionCode;
  if (deviceRegionCode) headers["X-Client-Region"] = deviceRegionCode;
  Object.assign(headers, readStoreBillingRequestHeaders());
  const token = useAuthStore.getState().accessToken;
  if (includeAuthorization && token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function refreshSessionAfterUnauthorizedResponse(): Promise<boolean> {
  refreshing ??= refreshAccessTokenWithRefreshToken().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

const submitHumanVerificationToken = (token: string) => sendHttpRequest<unknown>("POST", "/api/v1/security/human-verification", { body: { token } });

async function sendRequestWithHumanVerification<T>(method: Method, path: string, options?: RequestOptions): Promise<T> {
  try {
    return await sendHttpRequest<T>(method, path, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 428 || error.code !== "HUMAN_VERIFICATION_REQUIRED") throw error;
    if (!(await runHumanVerificationInAppBrowser("security_check", submitHumanVerificationToken))) throw error;
    return sendHttpRequest<T>(method, path, options);
  }
}

async function sendRequestWithTokenRefresh<T>(method: Method, path: string, options?: RequestOptions): Promise<T> {
  if (!useAuthStore.getState().accessToken && isBackgroundCallSkippedForGuests(method, path)) return undefined as T;
  try {
    return await sendRequestWithHumanVerification<T>(method, path, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || options?.auth === false) throw error;
    if (!useAuthStore.getState().accessToken) {
      if (method !== "GET") usePendingAuthIntentStore.getState().openSignInPrompt("continue");
      throw error;
    }
    if (!(await refreshSessionAfterUnauthorizedResponse())) throw error;
    return sendRequestWithHumanVerification<T>(method, path, options);
  }
}

export const toPageEnvelope = <T>(payload: unknown): Page<T> => {
  if (Array.isArray(payload)) return { data: payload as T[], nextCursor: null };
  const record = (payload ?? {}) as { data?: T[]; nextCursor?: string | null };
  return { data: record.data ?? [], nextCursor: record.nextCursor ?? null };
};

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => sendRequestWithTokenRefresh<T>("GET", path, { query }),
  getPage: async <T>(path: string, query?: RequestOptions["query"]) =>
    toPageEnvelope<T>(await sendRequestWithTokenRefresh<unknown>("GET", path, { query })),
  getList: async <T>(path: string, query?: RequestOptions["query"]) =>
    toPageEnvelope<T>(await sendRequestWithTokenRefresh<unknown>("GET", path, { query })).data,
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) => sendRequestWithTokenRefresh<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) => sendRequestWithTokenRefresh<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown) => sendRequestWithTokenRefresh<T>("PATCH", path, { body }),
  delete: <T>(path: string, options?: RequestOptions) => sendRequestWithTokenRefresh<T>("DELETE", path, options),
};

export const isNetworkFailureError = (error: unknown) => !(error instanceof ApiError);

export const isRetryableApiFailure = (error: unknown) =>
  isNetworkFailureError(error) || (error instanceof ApiError && (error.status === 408 || error.status === 429 || error.status >= 500));

export const generateIdempotencyKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
