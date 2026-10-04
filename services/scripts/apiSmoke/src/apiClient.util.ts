import { randomUUID } from "node:crypto";

export const gatewayUrl = process.env["SMOKE_GATEWAY_URL"] ?? "http://localhost:8080";

export interface ApiResponse<T = any> {
  readonly status: number;
  readonly body: T;
  readonly headers: Headers;
  readonly durationMs: number;
}

export interface ApiRequestOptions {
  readonly token?: string;
  readonly body?: unknown;
  readonly rawBody?: string;
  readonly headers?: Record<string, string>;
  readonly idempotent?: boolean;
  readonly baseUrl?: string;
}

export async function callApi<T = any>(method: string, path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { accept: "application/json", "x-device-id": "api-smoke", ...options.headers };
  if (options.token !== undefined) headers["authorization"] = `Bearer ${options.token}`;
  if (options.idempotent === true || (options.idempotent !== false && method !== "GET" && method !== "DELETE")) headers["idempotency-key"] ??= `smoke-${randomUUID()}`;
  let body: string | undefined;
  if (options.rawBody !== undefined) body = options.rawBody;
  else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers["content-type"] ??= "application/json";
  }
  const started = performance.now();
  const response = await fetch(`${options.baseUrl ?? gatewayUrl}${path}`, { method, headers, body, redirect: "manual" });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text === "" ? null : JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed as T, headers: response.headers, durationMs: performance.now() - started };
}

export function describeResponse(response: ApiResponse): string {
  return `${response.status} ${typeof response.body === "string" ? response.body.slice(0, 400) : JSON.stringify(response.body).slice(0, 600)}`;
}

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs = 15_000, intervalMs = 300): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return undefined;
}
