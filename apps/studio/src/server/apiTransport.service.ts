import { shouldUseRealBackend, readStudioApiBaseUrl } from "@/config/studioEnvironment.config";
import { ApiError } from "@/errors/api.error";
import type { dispatchMockApiRequest as MockDispatcher } from "@/mocks/dispatch.mock";
import type { ApiErrorBody } from "@/types/apiError.type";

const loadMockDispatcher: () => Promise<typeof MockDispatcher> =
  process.env.NODE_ENV === "production"
    ? () => Promise.reject(new Error("The mock backend is not bundled into production builds."))
    : async () => (await import("@/mocks/dispatch.mock")).dispatchMockApiRequest;

export interface BackendCall {
  readonly method: string;
  readonly path: string;
  readonly query?: URLSearchParams;
  readonly body?: Uint8Array | null;
  readonly contentType?: string | null;
  readonly accessToken?: string | null;
  readonly forwardedHeaders?: Record<string, string>;
}

export interface BackendResult {
  readonly status: number;
  readonly headers: Headers;
  readonly body: Uint8Array;
}

const backendTimeoutInMilliseconds = 15_000;
const textEncoder = new TextEncoder();

function buildOutgoingHeaders(call: BackendCall): Headers {
  const headers = new Headers({ Accept: "application/json" });
  if (call.contentType) headers.set("Content-Type", call.contentType);
  if (call.accessToken) headers.set("Authorization", `Bearer ${call.accessToken}`);
  headers.set("X-Request-Id", crypto.randomUUID());
  for (const [headerName, headerValue] of Object.entries(call.forwardedHeaders ?? {})) headers.set(headerName, headerValue);
  return headers;
}

function buildJsonResult(status: number, payload: unknown): BackendResult {
  if (payload === undefined) return { status: status === 200 ? 204 : status, headers: new Headers(), body: new Uint8Array() };
  return { status, headers: new Headers({ "Content-Type": "application/json; charset=utf-8" }), body: textEncoder.encode(JSON.stringify(payload)) };
}

function buildErrorResult(status: number, message: string, code: string): BackendResult {
  const body: ApiErrorBody = { message, code };
  return { status, headers: new Headers({ "Content-Type": "application/json; charset=utf-8" }), body: textEncoder.encode(JSON.stringify(body)) };
}

async function callMockBackend(call: BackendCall): Promise<BackendResult> {
  try {
    const value = await (await loadMockDispatcher())(call.method, call.path, call.query ?? new URLSearchParams(), call.body ?? null);
    return buildJsonResult(200, value);
  } catch (error) {
    if (error instanceof ApiError) return buildErrorResult(error.status, error.message, error.code ?? "MOCK_ERROR");
    return buildErrorResult(500, error instanceof Error ? error.message : "The mock backend failed.", "MOCK_FAILURE");
  }
}

async function callRealBackend(call: BackendCall, headers: Headers): Promise<BackendResult> {
  const queryText = call.query?.toString();
  const url = `${readStudioApiBaseUrl()}${call.path}${queryText ? `?${queryText}` : ""}`;
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutController.abort(), backendTimeoutInMilliseconds);
  try {
    const response = await fetch(url, {
      method: call.method,
      headers,
      body: call.body && call.body.byteLength > 0 ? Buffer.from(call.body) : undefined,
      signal: timeoutController.signal,
      redirect: "manual",
      cache: "no-store",
    });
    return { status: response.status, headers: response.headers, body: new Uint8Array(await response.arrayBuffer()) };
  } catch {
    const unavailableBody: ApiErrorBody = { message: "Nantty is not reachable right now. Try again in a moment.", code: "UPSTREAM_UNAVAILABLE" };
    return { status: 503, headers: new Headers({ "Content-Type": "application/json" }), body: textEncoder.encode(JSON.stringify(unavailableBody)) };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function stampRequestId(result: BackendResult, requestId: string | null): BackendResult {
  if (!requestId || result.headers.has("x-request-id")) return result;
  const headers = new Headers(result.headers);
  headers.set("x-request-id", requestId);
  return { ...result, headers };
}

export async function callStudioBackend(call: BackendCall): Promise<BackendResult> {
  const headers = buildOutgoingHeaders(call);
  const result = await (shouldUseRealBackend(call.path) ? callRealBackend(call, headers) : callMockBackend(call));
  return stampRequestId(result, headers.get("X-Request-Id"));
}

export function readJsonFromBackendResult<Payload>(result: BackendResult): Payload | null {
  if (result.body.byteLength === 0 || !(result.headers.get("content-type") ?? "").includes("json")) return null;
  try {
    return JSON.parse(new TextDecoder().decode(result.body)) as Payload;
  } catch {
    return null;
  }
}

export function encodeJsonRequestBody(payload: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(payload));
}
