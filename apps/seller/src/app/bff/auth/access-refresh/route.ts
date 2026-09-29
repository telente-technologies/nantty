import { NextResponse, type NextRequest } from "next/server";

import { findFirstPageAllowedForRole } from "@/config/rolePermissions.config";
import { readSafeRelativeRedirectPath } from "@/server/requestOriginGuard.service";
import { renewSellerAccessCache, writeRenewedSessionCookies } from "@/server/sellerAuthentication.service";
import { clearEverySessionCookie, readApiTokensFromCookies, readSessionIdFromCookies } from "@/server/sellerSession.service";
import { decideSellerAccessDestination, gatePagePathByDestination } from "@/utils/sellerAccessDestination.util";

export async function GET(request: NextRequest) {
  const requestedPath = readSafeRelativeRedirectPath(request.nextUrl.searchParams.get("next"), "/");
  const sessionId = readSessionIdFromCookies(request.cookies);
  const tokens = readApiTokensFromCookies(request.cookies);
  const renewed = sessionId ? await renewSellerAccessCache({ sessionId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, knownUser: null }) : null;
  if (!renewed) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    if (requestedPath !== "/") loginUrl.searchParams.set("next", requestedPath);
    const response = NextResponse.redirect(loginUrl, 303);
    clearEverySessionCookie(response);
    return response;
  }
  const destination = decideSellerAccessDestination(renewed.cachedAccess.access);
  const targetPath = destination === "app"
    ? requestedPath === "/" || requestedPath.startsWith("/access") ? findFirstPageAllowedForRole(renewed.cachedAccess.access.role) : requestedPath
    : requestedPath.startsWith("/access") ? requestedPath : gatePagePathByDestination[destination];
  const response = NextResponse.redirect(new URL(targetPath, request.nextUrl.origin), 303);
  writeRenewedSessionCookies(response, renewed);
  return response;
}
