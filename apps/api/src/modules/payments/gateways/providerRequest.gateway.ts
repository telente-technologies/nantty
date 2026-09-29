import { HttpError } from "@zudojs/http";

const PROVIDER_TIMEOUT_MILLISECONDS = 15_000;

export interface ProviderResponse {
  readonly status?: unknown;
  readonly message?: unknown;
  readonly data?: Record<string, unknown>;
}

export function providerUnavailable(): HttpError {
  return new HttpError(502, "The payment provider could not complete the request. Try again shortly.", { expose: true });
}

export async function sendProviderRequest(url: string, secretKey: string, method: "GET" | "POST", body?: unknown): Promise<ProviderResponse> {
  if (secretKey === "") throw providerUnavailable();
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
    });
  } catch {
    throw providerUnavailable();
  }
  const parsed = (await response.json().catch(() => ({}))) as ProviderResponse;
  if (!response.ok) throw providerUnavailable();
  return parsed;
}

export function parseWebhookJson(rawBody: Uint8Array): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(rawBody));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function readNestedRecord(record: Record<string, unknown> | undefined, field: string): Record<string, unknown> | undefined {
  const value = record?.[field];
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

export function readTextField(record: Record<string, unknown> | undefined, field: string): string | null {
  const value = record?.[field];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}
