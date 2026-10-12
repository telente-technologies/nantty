import { NextResponse, type NextRequest } from "next/server";

import { readRealtimeSocketUrl, shouldUseRealBackend } from "@/config/studioEnvironment.config";
import { isAccessTokenKnownExpired } from "@/server/accessTokenExpiry.service";
import { callStudioBackend, encodeJsonRequestBody, readJsonFromBackendResult } from "@/server/apiTransport.service";
import { exchangeRefreshTokenForNewTokenPair } from "@/server/authentication.service";
import { respondWithBffError } from "@/server/gateway.service";
import { readReusableRealtimeTicket, rememberRealtimeTicket } from "@/server/realtimeTicketCache.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";
import { clearEverySessionCookie, readApiTokensFromCookies, readSessionIdFromCookies, writeApiTokenCookies, type ApiTokenPair } from "@/server/session.service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

async function wantsFreshTicket(request: NextRequest): Promise<boolean> {
  const body = (await request.json().catch(() => null)) as { readonly fresh?: unknown } | null;
  return body?.fresh === true;
}

function respondSessionExpired(): NextResponse {
  const response = respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
  clearEverySessionCookie(response);
  return response;
}

export async function POST(request: NextRequest) {
  const sessionId = readSessionIdFromCookies(request.cookies);
  if (!sessionId) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  if (!shouldUseRealBackend("/ws")) return respondWithBffError(404, "REALTIME_UNAVAILABLE", "Live updates aren't available here. This page refreshes automatically.");
  const fresh = await wantsFreshTicket(request);
  const reusable = fresh ? null : readReusableRealtimeTicket(request.cookies, sessionId);
  if (reusable) return NextResponse.json({ url: readRealtimeSocketUrl(), realtimeToken: reusable }, { headers: noStore });

  const tokens = readApiTokensFromCookies(request.cookies);
  const rotation: { tokens: ApiTokenPair | null; attempted: boolean } = { tokens: null, attempted: false };
  const rotate = async (): Promise<string | null> => {
    if (rotation.attempted || !tokens.refreshToken) return null;
    rotation.attempted = true;
    rotation.tokens = await exchangeRefreshTokenForNewTokenPair(tokens.refreshToken);
    return rotation.tokens?.accessToken ?? null;
  };
  const accessToken = (tokens.accessToken && !isAccessTokenKnownExpired(tokens.accessToken) ? tokens.accessToken : null) ?? (await rotate());
  if (!accessToken) return respondSessionExpired();

  const issue = (token: string) => callStudioBackend({ method: "POST", path: "/api/v1/auth/realtime-token", accessToken: token, body: encodeJsonRequestBody({}), contentType: "application/json" });
  let issued = await issue(accessToken);
  const retriedToken = issued.status === 401 ? await rotate() : null;
  if (retriedToken) issued = await issue(retriedToken);
  if (issued.status === 401) return respondSessionExpired();
  if (issued.status === 429) {
    const limited = respondWithBffError(429, "RATE_LIMITED", "Live updates will resume in a moment.");
    const retryAfter = issued.headers.get("retry-after");
    if (retryAfter) limited.headers.set("Retry-After", retryAfter);
    return limited;
  }
  const grant = readJsonFromBackendResult<{ readonly realtimeToken?: unknown; readonly scope?: unknown }>(issued);
  if (issued.status !== 200 || typeof grant?.realtimeToken !== "string" || grant.scope !== "realtime") return respondWithBffError(503, "REALTIME_TOKEN_UNAVAILABLE", "Live updates will resume in a moment.");

  const response = NextResponse.json({ url: readRealtimeSocketUrl(), realtimeToken: grant.realtimeToken }, { headers: noStore });
  rememberRealtimeTicket(response, sessionId, grant.realtimeToken);
  if (rotation.tokens) writeApiTokenCookies(response, rotation.tokens);
  return response;
}
