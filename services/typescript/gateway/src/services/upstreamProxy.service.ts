import type { VerifiedPrincipal } from "./accessTokenVerifier.service.js";

export interface ProxiedRequest {
  readonly method: string;
  readonly pathWithQuery: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array | undefined;
  readonly requestId: string;
  readonly clientIp: string | undefined;
  readonly principal: VerifiedPrincipal | undefined;
}

export interface ProxiedResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: Uint8Array;
}

const forwardedRequestHeaders = ["accept", "authorization", "content-type", "idempotency-key", "if-none-match", "user-agent", "x-client-region", "x-device-id", "x-step-up-token"];
const returnedResponseHeaders = ["cache-control", "content-type", "etag", "idempotent-replayed", "retry-after", "x-request-id"];

export function buildUpstreamRequestHeaders(request: ProxiedRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of forwardedRequestHeaders) {
    const value = request.headers[name];
    if (value !== undefined) headers[name] = value;
  }
  headers["x-request-id"] = request.requestId;
  if (request.clientIp !== undefined) {
    headers["x-real-ip"] = request.clientIp;
    headers["x-forwarded-for"] = request.clientIp;
  }
  if (request.principal === undefined) headers["x-zudomart-viewer"] = "anonymous";
  if (request.principal !== undefined) {
    headers["x-zudomart-account-id"] = request.principal.accountId;
    headers["x-zudomart-session-id"] = request.principal.sessionId;
  }
  return headers;
}

export async function forwardRequestToUpstream(upstreamBaseUrl: string, request: ProxiedRequest, timeoutMs: number): Promise<ProxiedResponse> {
  const target = new URL(request.pathWithQuery, upstreamBaseUrl);
  const hasBody = request.body !== undefined && request.body.byteLength > 0 && request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(target, {
    method: request.method,
    headers: buildUpstreamRequestHeaders(request),
    ...(hasBody ? { body: request.body } : {}),
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const headers: Record<string, string> = {};
  for (const name of returnedResponseHeaders) {
    const value = response.headers.get(name);
    if (value !== null) headers[name] = value;
  }
  return { status: response.status, headers, body: new Uint8Array(await response.arrayBuffer()) };
}
