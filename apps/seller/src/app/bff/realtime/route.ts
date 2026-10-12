import { NextResponse, type NextRequest } from "next/server";

import { doesAccessGrantPermission } from "@/config/rolePermissions.config";
import { readRealtimeSocketUrl, shouldUseRealBackend } from "@/config/sellerEnvironment.config";
import { respondWithBffError } from "@/server/bffGateway.service";
import { readReusableRealtimeTicket, rememberRealtimeTicket } from "@/server/realtimeTicketCache.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";
import { exchangeRefreshTokenForNewTokenPair, renewSellerAccessCache, writeRenewedSessionCookies } from "@/server/sellerAuthentication.service";
import { callSellerBackend, encodeJsonRequestBody, readJsonFromBackendResult } from "@/server/sellerApiTransport.service";
import { readApiTokensFromCookies, readCachedSellerAccessFromCookies, readSelectedStoreIdFromCookies, readSessionIdFromCookies, writeApiTokenCookies } from "@/server/sellerSession.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessionId = readSessionIdFromCookies(request.cookies);
  if (!sessionId) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  const cookieTokens = readApiTokensFromCookies(request.cookies);
  const renewed = readCachedSellerAccessFromCookies(request.cookies) ? null : await renewSellerAccessCache({ ...cookieTokens, sessionId, knownUser: null, storeId: readSelectedStoreIdFromCookies(request.cookies) });
  const cached = readCachedSellerAccessFromCookies(request.cookies) ?? renewed?.cachedAccess ?? null;
  if (!cached) return respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
  if (!doesAccessGrantPermission(cached.access, "messages:manage")) return respondWithBffError(403, "FORBIDDEN", "Your role does not allow this. Ask a manager or the store owner.");
  if (!shouldUseRealBackend("/ws")) return respondWithBffError(404, "REALTIME_UNAVAILABLE", "Live updates aren't available here. Messages refresh automatically.");
  const reusable = readReusableRealtimeTicket(request.cookies, sessionId);
  if (reusable) return NextResponse.json({ url: readRealtimeSocketUrl(), realtimeToken: reusable }, { headers: { "Cache-Control": "no-store" } });
  const tokens = renewed?.tokens ?? cookieTokens;
  const rotated = tokens.accessToken ? null : tokens.refreshToken ? await exchangeRefreshTokenForNewTokenPair(tokens.refreshToken) : null;
  const accessToken = tokens.accessToken ?? rotated?.accessToken ?? null;
  if (!accessToken) return respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
  const issued = await callSellerBackend({ method: "POST", path: "/auth/realtime-token", accessToken, body: encodeJsonRequestBody({}), contentType: "application/json" });
  const grant = readJsonFromBackendResult<{ readonly realtimeToken?: unknown; readonly scope?: unknown }>(issued);
  if (issued.status === 429) return respondWithBffError(429, "RATE_LIMITED", "Live updates will resume in a moment.");
  if (issued.status !== 200 || typeof grant?.realtimeToken !== "string" || grant.scope !== "realtime") return respondWithBffError(503, "REALTIME_TOKEN_UNAVAILABLE", "Live updates will resume in a moment.");
  const response = NextResponse.json({ url: readRealtimeSocketUrl(), realtimeToken: grant.realtimeToken }, { headers: { "Cache-Control": "no-store" } });
  rememberRealtimeTicket(response, sessionId, grant.realtimeToken);
  if (renewed) writeRenewedSessionCookies(response, renewed);
  if (rotated) writeApiTokenCookies(response, rotated);
  return response;
}
