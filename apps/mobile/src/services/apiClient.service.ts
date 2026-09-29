import { apiConfig } from "@/config/api.config";
import { resolveMockApiRequest } from "@/mocks";
import { useAuthStore } from "@/store/auth.store";
import { useLocaleStore } from "@/store/locale.store";

import { ApiError } from "@/errors/api.error";

export { ApiError };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  readonly body?: unknown;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly idempotencyKey?: string;
  readonly auth?: boolean;
}

const appendQueryStringToPath = (path: string, query?: RequestOptions["query"]) => {
  const entries = Object.entries(query ?? {}).filter(([, v]) => v !== undefined) as [string, string | number | boolean][];
  if (entries.length === 0) return path;
  return `${path}?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")}`;
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
  if (apiConfig.useMocks) return resolveMockApiRequest<T>(method, url, options.body);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  const deviceRegionCode = useLocaleStore.getState().deviceRegionCode;
  if (deviceRegionCode) headers["X-Client-Region"] = deviceRegionCode;
  const token = useAuthStore.getState().accessToken;
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

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
      const error = (payload ?? {}) as { message?: string; code?: string };
      throw new ApiError(response.status, error.message ?? "Something went wrong", error.code);
    }
    return ((payload as { data?: T } | undefined)?.data ?? payload) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function sendRequestWithTokenRefresh<T>(method: Method, path: string, options?: RequestOptions): Promise<T> {
  try {
    return await sendHttpRequest<T>(method, path, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || options?.auth === false) throw error;
    refreshing ??= refreshAccessTokenWithRefreshToken().finally(() => {
      refreshing = null;
    });
    if (!(await refreshing)) throw error;
    return sendHttpRequest<T>(method, path, options);
  }
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => sendRequestWithTokenRefresh<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) => sendRequestWithTokenRefresh<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown) => sendRequestWithTokenRefresh<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => sendRequestWithTokenRefresh<T>("PATCH", path, { body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "body">) => sendRequestWithTokenRefresh<T>("DELETE", path, options),
};

export const isNetworkFailureError = (error: unknown) => !(error instanceof ApiError);

export const isRetryableApiFailure = (error: unknown) =>
  isNetworkFailureError(error) || (error instanceof ApiError && (error.status === 408 || error.status === 429 || error.status >= 500));

export const generateIdempotencyKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
