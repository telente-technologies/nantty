import { NextResponse, type NextRequest } from "next/server";

import { renewViewerSession, writeRenewedSessionCookies } from "@/server/authentication.service";
import { readSafeRelativeRedirectPath } from "@/server/requestOriginGuard.service";
import { clearEverySessionCookie, readApiTokensFromCookies, readSessionIdFromCookies } from "@/server/session.service";

export async function GET(request: NextRequest) {
  const requestedPath = readSafeRelativeRedirectPath(request.nextUrl.searchParams.get("next"), "/");
  const sessionId = readSessionIdFromCookies(request.cookies);
  const tokens = readApiTokensFromCookies(request.cookies);
  const renewed = sessionId ? await renewViewerSession({ sessionId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }) : null;
  if (!renewed) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    if (requestedPath !== "/") loginUrl.searchParams.set("next", requestedPath);
    const response = NextResponse.redirect(loginUrl, 303);
    clearEverySessionCookie(response);
    return response;
  }
  const response = NextResponse.redirect(new URL(requestedPath, request.nextUrl.origin), 303);
  writeRenewedSessionCookies(response, renewed);
  return response;
}
