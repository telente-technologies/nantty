import { NextResponse, type NextRequest } from "next/server";

import { renewCachedSessionView, writeRenewedSessionCookies } from "@/server/adsAuthentication.service";
import { clearEverySessionCookie, readApiTokensFromCookies, readSessionIdFromCookies } from "@/server/adsSession.service";
import { readSafeRelativeRedirectPath } from "@/server/requestOriginGuard.service";

export async function GET(request: NextRequest) {
  const requestedPath = readSafeRelativeRedirectPath(request.nextUrl.searchParams.get("next"), "/accounts");
  const sessionId = readSessionIdFromCookies(request.cookies);
  const tokens = readApiTokensFromCookies(request.cookies);
  const renewed = sessionId ? await renewCachedSessionView({ sessionId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, knownUser: null }) : null;
  if (!renewed) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    if (requestedPath !== "/accounts") loginUrl.searchParams.set("next", requestedPath);
    const response = NextResponse.redirect(loginUrl, 303);
    clearEverySessionCookie(response);
    return response;
  }
  const response = NextResponse.redirect(new URL(requestedPath, request.nextUrl.origin), 303);
  writeRenewedSessionCookies(response, renewed);
  return response;
}
