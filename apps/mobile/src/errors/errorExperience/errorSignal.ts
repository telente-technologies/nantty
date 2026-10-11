import type { ErrorSignal } from "./errorKinds";

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readErrorSignal(error: unknown): ErrorSignal {
  if (error === null || error === undefined) return {};
  if (typeof error !== "object") return {};
  const source = error as Record<string, unknown>;
  const name = readString(source, "name");
  if (name === "TimeoutError" || name === "AbortError") return { code: "TIMEOUT" };
  if (name === "TypeError" && /fetch|network|load failed/i.test(readString(source, "message") ?? "")) return { status: 0, code: "NETWORK_UNAVAILABLE" };
  const details = source["details"];
  const retryAfterSeconds = readNumber(source, "retryAfterSeconds") ?? readNumber(source, "retryAfter");
  return {
    status: readNumber(source, "status"),
    code: readString(source, "code"),
    details: details && typeof details === "object" ? (details as Record<string, unknown>) : null,
    requestId: readString(source, "requestId"),
    retryAfterSeconds: retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
    digest: readString(source, "digest"),
  };
}

export function readRequestIdHeader(headers: { get(name: string): string | null } | null | undefined): string | undefined {
  const value = headers?.get("x-request-id") ?? headers?.get("x-amzn-requestid") ?? null;
  return value && /^[A-Za-z0-9._:-]{4,128}$/.test(value) ? value : undefined;
}
