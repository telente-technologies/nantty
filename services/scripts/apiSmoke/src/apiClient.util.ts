import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export const gatewayUrl = process.env["SMOKE_GATEWAY_URL"] ?? "http://localhost:8080";
const latencyLog = process.env["SMOKE_LATENCY_LOG"];

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

function send(url: string, method: string, headers: Record<string, string>, body: string | undefined): Promise<{ status: number; text: string; headers: Headers }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const outgoing = (target.protocol === "https:" ? httpsRequest : httpRequest)(target, { method, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(response.headers)) if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
        resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8"), headers: responseHeaders });
      });
      response.on("error", reject);
    });
    outgoing.on("error", reject);
    outgoing.end(body);
  });
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
  const response = await send(`${options.baseUrl ?? gatewayUrl}${path}`, method, headers, body);
  const text = response.text;
  let parsed: unknown = text;
  try {
    parsed = text === "" ? null : JSON.parse(text);
  } catch {
    parsed = text;
  }
  const durationMs = performance.now() - started;
  if (latencyLog !== undefined && latencyLog !== "") appendFileSync(latencyLog, `${JSON.stringify({ method, path: path.split("?")[0], status: response.status, durationMs })}\n`);
  return { status: response.status, body: parsed as T, headers: response.headers, durationMs };
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
