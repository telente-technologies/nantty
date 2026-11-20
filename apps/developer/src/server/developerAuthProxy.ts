import { NextRequest, NextResponse } from "next/server";

import { accessCookieName } from "./developerSso";

const maxBodyBytes = 16 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const birthdayPattern = /^\d{4}-\d{2}-\d{2}$/;
const usernamePattern = /^[a-z0-9._-]{3,30}$/;

function readApiBaseUrl(): URL | null {
  const configured = process.env.DEVELOPER_API_BASE_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && localHost && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function jsonResponse(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function verifyMutationOrigin(request: NextRequest): NextResponse | null {
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonResponse(403, { code: "CSRF_REJECTED", message: "This request could not be verified. Reload the page and try again." });
  }
  return null;
}

async function readJsonPayload(request: NextRequest): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > maxBodyBytes) {
    return { ok: false, response: jsonResponse(413, { code: "PAYLOAD_TOO_LARGE", message: "That request is too large." }) };
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: jsonResponse(415, { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send authentication requests as JSON." }) };
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
    return { ok: false, response: jsonResponse(413, { code: "PAYLOAD_TOO_LARGE", message: "That request is too large." }) };
  }
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, response: jsonResponse(400, { code: "INVALID_JSON", message: "The request body must be a JSON object." }) };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonResponse(400, { code: "INVALID_JSON", message: "The request body must be valid JSON." }) };
  }
}

function forwardSessionResponse(status: number, payload: unknown): NextResponse {
  if (!payload || typeof payload !== "object") {
    return jsonResponse(502, { code: "IDENTITY_INVALID_RESPONSE", message: "Could not complete sign-in. Please try again." });
  }
  const record = payload as {
    accessToken?: unknown;
    expiresIn?: unknown;
    user?: unknown;
    isNewUser?: unknown;
    notice?: unknown;
  };
  if (typeof record.accessToken !== "string" || !record.accessToken) {
    return jsonResponse(502, { code: "IDENTITY_TOKEN_MISSING", message: "Identity server returned no access token." });
  }
  const response = jsonResponse(status, {
    authenticated: true,
    user: record.user ?? null,
    isNewUser: Boolean(record.isNewUser),
    notice: typeof record.notice === "string" ? record.notice : null,
  });
  const maxAge =
    typeof record.expiresIn === "number" && Number.isFinite(record.expiresIn)
      ? Math.max(1, Math.min(900, Math.floor(record.expiresIn)))
      : 900;
  response.cookies.set(accessCookieName(), record.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return response;
}

function forwardClientError(upstreamStatus: number, text: string, fallbackMessage: string): NextResponse {
  let parsed: { code?: unknown; message?: unknown } | null;
  try {
    parsed = JSON.parse(text) as { code?: unknown; message?: unknown };
  } catch {
    parsed = null;
  }
  const status = upstreamStatus >= 500 ? 503 : upstreamStatus;
  return jsonResponse(status, {
    code: typeof parsed?.code === "string" ? parsed.code : upstreamStatus >= 500 ? "IDENTITY_UNAVAILABLE" : "AUTH_REQUEST_FAILED",
    message:
      upstreamStatus >= 500
        ? "Identity service is temporarily unavailable. Try again shortly."
        : typeof parsed?.message === "string"
          ? parsed.message
          : fallbackMessage,
  });
}

export async function forwardDeveloperPasswordLoginRequest(request: NextRequest): Promise<NextResponse> {
  const csrfError = verifyMutationOrigin(request);
  if (csrfError) return csrfError;

  const baseUrl = readApiBaseUrl();
  if (!baseUrl) {
    return jsonResponse(503, { code: "DEVELOPER_API_NOT_CONFIGURED", message: "Sign-in service is temporarily unavailable." });
  }

  const parsed = await readJsonPayload(request);
  if (!parsed.ok) return parsed.response;

  const identifier = typeof parsed.data.identifier === "string" ? parsed.data.identifier.trim() : "";
  const password = typeof parsed.data.password === "string" ? parsed.data.password : "";
  if (!identifier || !password || identifier.length > 254 || password.length > 256) {
    return jsonResponse(400, { code: "INVALID_CREDENTIALS_INPUT", message: "Enter your email or username and password." });
  }

  try {
    const upstream = await fetch(new URL("/api/v1/auth/login", baseUrl), {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const text = await upstream.text();
    if (!upstream.ok) return forwardClientError(upstream.status, text, "Invalid credentials.");
    const payload: unknown = text ? JSON.parse(text) : null;
    return forwardSessionResponse(200, payload);
  } catch {
    return jsonResponse(503, { code: "IDENTITY_UNAVAILABLE", message: "Sign-in service is temporarily unavailable. Try again shortly." });
  }
}

export async function forwardDeveloperRegisterRequest(request: NextRequest): Promise<NextResponse> {
  const csrfError = verifyMutationOrigin(request);
  if (csrfError) return csrfError;

  const baseUrl = readApiBaseUrl();
  if (!baseUrl) {
    return jsonResponse(503, { code: "DEVELOPER_API_NOT_CONFIGURED", message: "Account registration is temporarily unavailable." });
  }

  const parsed = await readJsonPayload(request);
  if (!parsed.ok) return parsed.response;

  const email = typeof parsed.data.email === "string" ? parsed.data.email.trim().toLowerCase() : "";
  const password = typeof parsed.data.password === "string" ? parsed.data.password : "";
  const birthday = typeof parsed.data.birthday === "string" ? parsed.data.birthday.trim() : "";
  const otpToken = typeof parsed.data.otpToken === "string" ? parsed.data.otpToken.trim() : "";
  const name = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";
  const username = typeof parsed.data.username === "string" ? parsed.data.username.trim().toLowerCase() : "";

  if (!emailPattern.test(email) || email.length > 254) {
    return jsonResponse(400, { code: "INVALID_EMAIL", message: "Enter a valid email address." });
  }
  if (!otpToken || otpToken.length > 4096) {
    return jsonResponse(400, { code: "OTP_TOKEN_REQUIRED", message: "Verify your 6-digit email code before creating your account." });
  }
  if (!birthdayPattern.test(birthday)) {
    return jsonResponse(400, { code: "INVALID_BIRTHDAY", message: "Enter your date of birth in YYYY-MM-DD format." });
  }
  if (password.length < 8 || password.length > 256) {
    return jsonResponse(400, { code: "INVALID_PASSWORD", message: "Use a password of at least 8 characters." });
  }
  if (username && !usernamePattern.test(username)) {
    return jsonResponse(400, {
      code: "INVALID_USERNAME",
      message: "Usernames must be 3–30 lowercase letters, numbers, dots, underscores, or hyphens.",
    });
  }

  try {
    const upstream = await fetch(new URL("/api/v1/auth/register", baseUrl), {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        email,
        birthday,
        password,
        otpToken,
        ...(name ? { name: name.slice(0, 80) } : {}),
        ...(username ? { username } : {}),
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const text = await upstream.text();
    if (!upstream.ok) return forwardClientError(upstream.status, text, "Could not create your Nantty account.");
    const payload: unknown = text ? JSON.parse(text) : null;
    return forwardSessionResponse(201, payload);
  } catch {
    return jsonResponse(503, { code: "IDENTITY_UNAVAILABLE", message: "Account registration is temporarily unavailable. Try again shortly." });
  }
}

export async function forwardDeveloperUsernameAvailabilityRequest(request: NextRequest): Promise<NextResponse> {
  const baseUrl = readApiBaseUrl();
  if (!baseUrl) {
    return jsonResponse(503, { code: "DEVELOPER_API_NOT_CONFIGURED", message: "Username check is temporarily unavailable." });
  }
  const username = request.nextUrl.searchParams.get("username")?.trim().toLowerCase() ?? "";
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!username) {
    return jsonResponse(400, { code: "USERNAME_REQUIRED", message: "Enter a username to check." });
  }

  const upstreamUrl = new URL("/api/v1/auth/username-available", baseUrl);
  upstreamUrl.searchParams.set("username", username.slice(0, 64));
  if (name) upstreamUrl.searchParams.set("name", name.slice(0, 80));

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(6_000),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status >= 500 ? 503 : upstream.status,
      headers: { "content-type": "application/json", "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return jsonResponse(503, { code: "IDENTITY_UNAVAILABLE", message: "Username check is temporarily unavailable." });
  }
}
