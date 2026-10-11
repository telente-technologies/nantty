import { shouldUseRealBackend, readAdminApiBaseUrl } from "@/config/adminEnvironment.config";
import type { dispatchMockApiRequest as MockDispatcher } from "@/mocks/mockBackend.mock";
import type { ApiErrorBody } from "@/types/api.type";
import { toServerListEnvelope } from "@/utils/listEnvelope.util";

const loadMockDispatcher: () => Promise<typeof MockDispatcher> =
  process.env.NODE_ENV === "production"
    ? () => Promise.reject(new Error("The mock backend is not bundled into production builds."))
    : async () => (await import("@/mocks/mockBackend.mock")).dispatchMockApiRequest;

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

const backendTimeoutInMilliseconds = 20_000;
const textEncoder = new TextEncoder();

function buildOutgoingHeaders(call: BackendCall): Headers {
  const headers = new Headers({ Accept: "application/json, text/csv;q=0.9" });
  if (call.contentType) headers.set("Content-Type", call.contentType);
  if (call.accessToken) headers.set("Authorization", `Bearer ${call.accessToken}`);
  headers.set("X-Request-Id", crypto.randomUUID());
  headers.set("X-Client-App", "zudomart-admin");
  for (const [headerName, headerValue] of Object.entries(call.forwardedHeaders ?? {})) headers.set(headerName, headerValue);
  return headers;
}

async function callMockBackend(call: BackendCall, headers: Headers): Promise<BackendResult> {
  const mockResponse = await (await loadMockDispatcher())({ method: call.method, path: call.path, query: call.query ?? new URLSearchParams(), headers, body: call.body ?? null });
  const responseHeaders = new Headers(mockResponse.headers);
  if (mockResponse.status === 204 || mockResponse.body === null || mockResponse.body === undefined) return { status: mockResponse.status, headers: responseHeaders, body: new Uint8Array() };
  if (typeof mockResponse.body === "string") {
    responseHeaders.set("Content-Type", mockResponse.contentType ?? "text/plain; charset=utf-8");
    return { status: mockResponse.status, headers: responseHeaders, body: textEncoder.encode(mockResponse.body) };
  }
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return { status: mockResponse.status, headers: responseHeaders, body: textEncoder.encode(JSON.stringify(toServerListEnvelope(mockResponse.body))) };
}

async function callRealBackend(call: BackendCall, headers: Headers): Promise<BackendResult> {
  const queryText = call.query?.toString();
  const url = `${readAdminApiBaseUrl()}/api/v1${call.path}${queryText ? `?${queryText}` : ""}`;
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
    const unavailableBody: ApiErrorBody = { message: "The Zudomart API is not reachable right now. Try again in a moment.", code: "UPSTREAM_UNAVAILABLE" };
    return { status: 503, headers: new Headers({ "Content-Type": "application/json" }), body: textEncoder.encode(JSON.stringify(unavailableBody)) };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function callAdminBackend(call: BackendCall): Promise<BackendResult> {
  const headers = buildOutgoingHeaders(call);
  return shouldUseRealBackend(`/api/v1${call.path}`) ? callRealBackend(call, headers) : callMockBackend(call, headers);
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

export async function sendJsonToAdminBackend<Payload>(method: string, path: string, payload: unknown, extra: Omit<BackendCall, "method" | "path" | "body" | "contentType"> = {}): Promise<{ status: number; body: Payload | null; error: ApiErrorBody | null }> {
  const result = await callAdminBackend({ ...extra, method, path, body: payload === undefined ? null : encodeJsonRequestBody(payload), contentType: payload === undefined ? null : "application/json" });
  const parsed = readJsonFromBackendResult<Payload & Partial<ApiErrorBody>>(result);
  const isSuccess = result.status >= 200 && result.status < 300;
  return { status: result.status, body: isSuccess ? parsed : null, error: isSuccess ? null : ((parsed as ApiErrorBody | null) ?? { message: "The request failed.", code: `HTTP_${result.status}` }) };
}
