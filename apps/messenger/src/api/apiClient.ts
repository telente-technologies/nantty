import Constants from "expo-constants";
import { Platform } from "react-native";

import { ApiError } from "./apiError";
export { ApiError } from "./apiError";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  readonly method?: HttpMethod;
  readonly accessToken?: string | null;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

const developmentApiUrl = Platform.OS === "android" ? "http://10.0.2.2:8080" : "http://localhost:8080";
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim()
  || (__DEV__ ? developmentApiUrl : Constants.expoConfig?.extra?.apiUrl || "https://api.nantty.com");
export const apiBaseUrl = configuredApiUrl.trim().replace(/\/+$/, "");

export function isApiConfigured(): boolean {
  if (!apiBaseUrl) return false;
  try {
    const url = new URL(apiBaseUrl);
    return url.protocol === "https:" || (__DEV__ && url.protocol === "http:" && isPrivateDevelopmentHost(url.hostname));
  } catch {
    return false;
  }
}

function isPrivateDevelopmentHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "10.0.2.2" || host === "::1" || host === "127.0.0.1") return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || octets[0] === 127;
}

function unwrap<T>(payload: unknown): T {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return payload as T;
  const record = payload as Record<string, unknown>;
  if ("nextCursor" in record) return payload as T;
  return (record.data ?? payload) as T;
}

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError("Nantty is temporarily unavailable. Please try again.", null, "API_UNAVAILABLE");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const headers: Record<string, string> = { Accept: "application/json", "X-Request-Id": createRequestId(), ...options.headers };
    if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);

    if (!response.ok) {
      const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
      const message = getSafeApiMessage(record, response.status);
      const code = typeof record.code === "string" ? record.code : undefined;
      throw new ApiError(message, response.status, code);
    }

    return unwrap<T>(payload);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError("The request timed out. Check your connection and try again.", null, "REQUEST_TIMEOUT");
    throw new ApiError("Could not reach Nantty. Check your connection and try again.", null, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function getSafeApiMessage(record: Record<string, unknown>, status: number): string {
  const code = typeof record.code === "string" ? record.code : "";
  if (code === "MESSENGER_CODE_INVALID") return "That code is invalid or expired. Check it and try again.";
  if (code === "MESSENGER_CODE_ATTEMPTS_EXCEEDED") return "Too many code attempts. Start sign-in again to request a new code.";
  if (code === "MESSENGER_AUTHORIZATION_DENIED") return "This sign-in was denied from your trusted Nantty session.";
  if (code === "MESSENGER_AUTHORIZATION_EXPIRED") return "This sign-in request expired. Start again.";
  if (status === 401) return "Those sign-in details don’t match an existing Nantty account.";
  if (status === 429) return "Too many attempts. Wait a little and try again.";
  if (status >= 500) return "Nantty is temporarily unavailable. Please try again.";
  if (typeof record.message !== "string") return "We couldn’t complete that request. Please try again.";

  const message = record.message.trim();
  if (!message || /environment|variable|localhost|endpoint|token|database|server|http|configuration|internal/i.test(message)) {
    return "We couldn’t complete that request. Please try again.";
  }
  return message;
}

function createRequestId(): string {
  return `messenger-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
