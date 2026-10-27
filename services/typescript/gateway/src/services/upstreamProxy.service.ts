import type { VerifiedPrincipal } from "./accessTokenVerifier.service.js";
import { identitySignatureHeaderName, signGatewayIdentity } from "./gatewayIdentitySigner.service.js";

export interface ProxiedRequest {
  readonly method: string;
  readonly pathWithQuery: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array | undefined;
  readonly requestId: string;
  readonly clientIp: string | undefined;
  readonly principal: VerifiedPrincipal | undefined;
  readonly traceparent?: string;
  readonly forwardWebhookSignatureHeaders?: boolean;
  readonly allowRedirect?: boolean;
  readonly trustCdnCountryHeader?: boolean;
}

export interface ProxiedResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: Uint8Array;
}

const forwardedRequestHeaders = ["accept", "authorization", "content-type", "idempotency-key", "if-match", "if-none-match", "x-chunk-sha256", "x-seller-store", "x-seller-location", "user-agent", "x-client-platform", "x-client-region", "x-device-id", "x-step-up-token", "x-store-storefront"];
const cdnCountryHeader = "cloudfront-viewer-country";
const webhookSignatureHeaders = ["verif-hash", "flutterwave-signature", "x-signature", "x-apple-signature", "x-goog-signature", "x-nantty-push-token", "x-webhook-id", "x-webhook-timestamp"];
const returnedResponseHeaders = ["cache-control", "content-type", "etag", "idempotent-replayed", "retry-after", "x-request-id"];

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export function isSafeRedirectLocation(location: string): boolean {
  if (location.length > 2048 || /[\s\\]/.test(location)) return false;
  try {
    const parsed = new URL(location);
    if (parsed.protocol === "nantty:") return true;
    return parsed.protocol === "https:" && parsed.hostname !== "" && parsed.username === "" && parsed.password === "";
  } catch {
    return false;
  }
}

export function buildUpstreamRequestHeaders(request: ProxiedRequest, identitySecret?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of forwardedRequestHeaders) {
    const value = request.headers[name];
    if (value !== undefined) headers[name] = value;
  }
  const cdnCountry = request.headers[cdnCountryHeader];
  if (request.trustCdnCountryHeader === true && cdnCountry !== undefined) headers[cdnCountryHeader] = cdnCountry;
  if (request.forwardWebhookSignatureHeaders === true) {
    for (const name of webhookSignatureHeaders) {
      const value = request.headers[name];
      if (value !== undefined) headers[name] = value;
    }
  }
  headers["x-request-id"] = request.requestId;
  if (request.traceparent !== undefined) headers["traceparent"] = request.traceparent;
  if (request.clientIp !== undefined) {
    headers["x-real-ip"] = request.clientIp;
    headers["x-forwarded-for"] = request.clientIp;
  }
  if (request.principal === undefined) headers["x-nantty-viewer"] = "anonymous";
  headers["x-nantty-age-bracket"] = request.principal?.ageBracket ?? "unknown";
  if (request.principal !== undefined) {
    headers["x-nantty-account-id"] = request.principal.accountId;
    headers["x-nantty-session-id"] = request.principal.sessionId;
  }
  if (identitySecret !== undefined && identitySecret !== "") {
    const path = new URL(request.pathWithQuery, "http://gateway.invalid").pathname;
    headers[identitySignatureHeaderName] = signGatewayIdentity(identitySecret, { method: request.method, path, requestId: request.requestId, headers, issuedAtSeconds: Math.floor(Date.now() / 1000) });
  }
  return headers;
}

export async function forwardRequestToUpstream(upstreamBaseUrl: string, request: ProxiedRequest, timeoutMs: number, identitySecret?: string): Promise<ProxiedResponse> {
  const target = new URL(request.pathWithQuery, upstreamBaseUrl);
  const hasBody = request.body !== undefined && request.body.byteLength > 0 && request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(target, {
    method: request.method,
    headers: buildUpstreamRequestHeaders(request, identitySecret),
    ...(hasBody ? { body: request.body } : {}),
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const headers: Record<string, string> = {};
  for (const name of returnedResponseHeaders) {
    const value = response.headers.get(name);
    if (value !== null) headers[name] = value;
  }
  const location = response.headers.get("location");
  if (request.allowRedirect === true && redirectStatuses.has(response.status) && location !== null) {
    if (!isSafeRedirectLocation(location)) return { status: 502, headers: { "content-type": "application/json" }, body: new TextEncoder().encode(JSON.stringify({ message: "The link could not be opened.", code: "UNSAFE_REDIRECT" })) };
    headers["location"] = location;
  }
  return { status: response.status, headers, body: new Uint8Array(await response.arrayBuffer()) };
}
