import { NextRequest, NextResponse } from "next/server";

import { isAllowedDeveloperOrganizationRoute, shouldForwardDeveloperIdempotencyKey } from "./developerOrganizationRoutePolicy";

const maxBodyBytes = 16 * 1024;
const accountAccessCookie = "__Host-zd_at";
const localAccessCookie = "zd_webapp_at";
const organizationBasePath = "/api/v1/developer/organizations";
const invitationInboxBasePath = "/api/v1/developer/invitations";
const stepUpTokenPattern = /^[A-Za-z0-9._-]{32,8192}$/;
const otpCodePattern = /^\d{6}$/;
const otpPurposes = new Set(["login", "signup", "reset"]);

function readApiBaseUrl(): URL | null {
  const configured = process.env.DEVELOPER_API_BASE_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && localHost && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ code, message }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function readOrganizationPath(request: NextRequest): { basePath: string; path: string[] } | null {
  const prefix = "/api/developer/organizations";
  const pathname = request.nextUrl.pathname;
  const invitationPrefix = "/api/developer/invitations";
  if (pathname === prefix) return { basePath: organizationBasePath, path: [] };
  if (pathname === invitationPrefix) return { basePath: invitationInboxBasePath, path: [] };
  const matchedPrefix = pathname.startsWith(`${prefix}/`) ? { prefix, basePath: organizationBasePath } : pathname.startsWith(`${invitationPrefix}/`) ? { prefix: invitationPrefix, basePath: invitationInboxBasePath } : null;
  if (!matchedPrefix) return null;
  try { return { basePath: matchedPrefix.basePath, path: pathname.slice(matchedPrefix.prefix.length + 1).split("/").map((segment) => decodeURIComponent(segment)) }; }
  catch { return null; }
}

export async function forwardDeveloperOrganizationRequest(request: NextRequest): Promise<NextResponse> {
  const target = readOrganizationPath(request);
  if (!target) return jsonError(404, "NOT_FOUND", "This organization endpoint is not available.");
  const { path, basePath } = target;
  if (!isAllowedDeveloperOrganizationRoute(request.method, path, basePath)) return jsonError(404, "NOT_FOUND", "This organization endpoint is not available.");
  const baseUrl = readApiBaseUrl();
  if (!baseUrl) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "The organization service is temporarily unavailable. Try again shortly.");

  const accessToken = request.cookies.get(process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie)?.value;
  if (!accessToken) {
    if (process.env.NODE_ENV === "production") return jsonError(503, "PORTAL_SSO_NOT_CONFIGURED", "Sign-in is temporarily unavailable. Try again shortly.");
    return jsonError(401, "UNAUTHENTICATED", "Sign in to Nantty to manage an organization.");
  }

  const mutating = !["GET", "HEAD"].includes(request.method);
  if (mutating && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) {
    return jsonError(403, "CSRF_REJECTED", "This organization request could not be verified. Reload the page and try again.");
  }

  let body: string | undefined;
  if (mutating && request.method !== "DELETE") {
    const declaredBytes = Number(request.headers.get("content-length") ?? 0);
    if (declaredBytes > maxBodyBytes) return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
    if (rawBody) {
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "Send organization changes as JSON.");
      try { JSON.parse(rawBody); } catch { return jsonError(400, "INVALID_JSON", "The request body must be valid JSON."); }
      body = rawBody;
    }
  }

  const upstreamUrl = new URL(`${basePath}${path.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`, baseUrl);
  if (path.at(-1) === "audit-log") {
    const limit = request.nextUrl.searchParams.get("limit");
    if (limit && /^\d{1,3}$/.test(limit)) upstreamUrl.searchParams.set("limit", limit);
  }
  const headers = new Headers({ accept: "application/json", authorization: `Bearer ${accessToken}` });
  if (body !== undefined) headers.set("content-type", "application/json");
  const idempotencyKey = request.headers.get("idempotency-key");
  if (shouldForwardDeveloperIdempotencyKey(request.method, path, basePath, idempotencyKey)) headers.set("idempotency-key", idempotencyKey);
  const stepUpToken = request.headers.get("x-step-up-token");
  if (request.method === "POST" && path.at(-1) === "ownership-transfer" && stepUpToken && stepUpTokenPattern.test(stepUpToken)) headers.set("x-step-up-token", stepUpToken);

  try {
    const upstream = await fetch(upstreamUrl, { method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
    const responseHeaders = new Headers({ "Cache-Control": "no-store, max-age=0" });
    for (const name of ["content-type", "x-request-id", "idempotent-replayed"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.status === 204 ? null : await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return jsonError(502, "DEVELOPER_API_UNAVAILABLE", "The organization service could not be reached. Try again shortly.");
  }
}

export async function forwardDeveloperStepUpRequest(request: NextRequest): Promise<NextResponse> {
  if (request.method !== "POST" || request.nextUrl.pathname !== "/api/developer/step-up") return jsonError(404, "NOT_FOUND", "This authentication endpoint is not available.");
  const baseUrl = readApiBaseUrl();
  if (!baseUrl) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "Identity confirmation is temporarily unavailable. Try again shortly.");
  const accessToken = request.cookies.get(process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie)?.value;
  if (!accessToken) return jsonError(process.env.NODE_ENV === "production" ? 503 : 401, process.env.NODE_ENV === "production" ? "PORTAL_SSO_NOT_CONFIGURED" : "UNAUTHENTICATED", process.env.NODE_ENV === "production" ? "Sign-in is temporarily unavailable. Try again shortly." : "Sign in to Nantty to confirm your identity.");
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") return jsonError(403, "CSRF_REJECTED", "This authentication request could not be verified.");
  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > maxBodyBytes) return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "Send identity confirmation as JSON.");
  try { JSON.parse(rawBody); } catch { return jsonError(400, "INVALID_JSON", "The request body must be valid JSON."); }
  try {
    const upstreamUrl = new URL("/api/v1/auth/step-up", baseUrl);
    const upstream = await fetch(upstreamUrl, { method: "POST", headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${accessToken}` }, body: rawBody, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
    const responseHeaders = new Headers({ "Cache-Control": "no-store, max-age=0" });
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return jsonError(502, "DEVELOPER_API_UNAVAILABLE", "Identity could not confirm your session. Try again shortly.");
  }
}

async function readValidatedOtpJson(request: NextRequest): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return { ok: false, response: jsonError(403, "CSRF_REJECTED", "This verification request could not be verified.") };
  }
  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > maxBodyBytes) return { ok: false, response: jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.") };
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) return { ok: false, response: jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.") };
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "Send verification payloads as JSON.") };
  }
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, response: jsonError(400, "INVALID_JSON", "The request body must be a JSON object.") };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonError(400, "INVALID_JSON", "The request body must be valid JSON.") };
  }
}

export async function forwardDeveloperOtpSendRequest(request: NextRequest): Promise<NextResponse> {
  if (request.method !== "POST" || request.nextUrl.pathname !== "/api/developer/otp/send") {
    return jsonError(404, "NOT_FOUND", "This verification endpoint is not available.");
  }
  const baseUrl = readApiBaseUrl();
  if (!baseUrl) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "One-time code delivery is temporarily unavailable. Try again shortly.");
  const parsed = await readValidatedOtpJson(request);
  if (!parsed.ok) return parsed.response;

  const destination = typeof parsed.data.destination === "string" ? parsed.data.destination.trim() : "";
  const purpose = typeof parsed.data.purpose === "string" ? parsed.data.purpose.trim() : "login";
  if (destination.length < 3 || destination.length > 254 || !otpPurposes.has(purpose)) {
    return jsonError(400, "INVALID_OTP_REQUEST", "Enter a valid account email address to receive a 6-digit code.");
  }

  const accessToken = request.cookies.get(process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie)?.value;
  const headers = new Headers({ accept: "application/json", "content-type": "application/json" });
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  try {
    const upstream = await fetch(new URL("/api/v1/auth/otp/send", baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({ destination, purpose }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store, max-age=0" });
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return jsonError(502, "DEVELOPER_API_UNAVAILABLE", "Identity could not send a verification code right now.");
  }
}

export async function forwardDeveloperOtpVerifyRequest(request: NextRequest): Promise<NextResponse> {
  if (request.method !== "POST" || request.nextUrl.pathname !== "/api/developer/otp/verify") {
    return jsonError(404, "NOT_FOUND", "This verification endpoint is not available.");
  }
  const baseUrl = readApiBaseUrl();
  if (!baseUrl) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "One-time code verification is temporarily unavailable. Try again shortly.");
  const parsed = await readValidatedOtpJson(request);
  if (!parsed.ok) return parsed.response;

  const destination = typeof parsed.data.destination === "string" ? parsed.data.destination.trim() : "";
  const code = typeof parsed.data.code === "string" ? parsed.data.code.trim() : "";
  const purpose = typeof parsed.data.purpose === "string" ? parsed.data.purpose.trim() : "login";
  if (destination.length < 3 || destination.length > 254 || !otpCodePattern.test(code) || !otpPurposes.has(purpose)) {
    return jsonError(400, "INVALID_OTP_CODE", "Enter your account email and the 6-digit verification code.");
  }

  const accessToken = request.cookies.get(process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie)?.value;
  const headers = new Headers({ accept: "application/json", "content-type": "application/json" });
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  try {
    const upstream = await fetch(new URL("/api/v1/auth/otp/verify", baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({ destination, code, purpose }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store, max-age=0" });
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return jsonError(502, "DEVELOPER_API_UNAVAILABLE", "Identity could not verify that code right now.");
  }
}
