import { NextResponse, type NextRequest } from "next/server";

import { renewCachedSessionView, convertCurrentUserToAdsUser, writeRenewedSessionCookies } from "@/server/adsAuthentication.service";
import { callAdsBackend, encodeJsonRequestBody, readJsonFromBackendResult } from "@/server/adsApiTransport.service";
import { createNewSessionId, writeApiTokenCookies, writeSessionIdCookie, type ApiTokenPair } from "@/server/adsSession.service";
import { respondWithBffError } from "@/server/bffGateway.service";
import { isRequestFromAdsManagerOrigin, readSafeRelativeRedirectPath } from "@/server/requestOriginGuard.service";
import type { ApiErrorBody } from "@/types/api.type";

interface LoginResponseBody extends ApiTokenPair {
  readonly user: { id: string; name: string | null; username: string | null; email: string | null; avatarUrl: string | null };
}

export async function POST(request: NextRequest) {
  if (!isRequestFromAdsManagerOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This sign-in request could not be verified.");
  const body = (await request.json().catch(() => null)) as { identifier?: unknown; password?: unknown; next?: unknown } | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (identifier.length < 3 || identifier.length > 254 || password.length < 1 || password.length > 128) {
    return respondWithBffError(400, "VALIDATION_FAILED", "Enter your email or username and your password.");
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 200) ?? "nantty-ads-manager";
  const loginResult = await callAdsBackend({ method: "POST", path: "/auth/login", body: encodeJsonRequestBody({ identifier, password }), contentType: "application/json", forwardedHeaders: { "User-Agent": userAgent } });
  if (loginResult.status !== 200) {
    const errorBody = readJsonFromBackendResult<ApiErrorBody>(loginResult);
    const isRateLimited = loginResult.status === 429;
    return respondWithBffError(isRateLimited ? 429 : 401, errorBody?.code ?? "INVALID_CREDENTIALS", isRateLimited ? "Too many attempts. Wait a minute and try again." : errorBody?.message ?? "That email, username or password is not right.");
  }
  const loginBody = readJsonFromBackendResult<LoginResponseBody>(loginResult);
  if (!loginBody) return respondWithBffError(502, "BAD_UPSTREAM_RESPONSE", "Sign-in failed. Try again.");

  const sessionId = createNewSessionId();
  const renewed = await renewCachedSessionView({ sessionId, accessToken: loginBody.accessToken, refreshToken: loginBody.refreshToken, knownUser: convertCurrentUserToAdsUser(loginBody.user) });
  if (!renewed) return respondWithBffError(502, "SESSION_SETUP_FAILED", "We signed you in but could not load your ad accounts. Try again.");

  const redirectTo = readSafeRelativeRedirectPath(typeof body?.next === "string" ? body.next : null, "/accounts");
  const response = NextResponse.json({ redirectTo }, { headers: { "Cache-Control": "no-store" } });
  writeSessionIdCookie(response, sessionId);
  writeApiTokenCookies(response, renewed.tokens ?? loginBody);
  writeRenewedSessionCookies(response, { ...renewed, tokens: null });
  return response;
}
