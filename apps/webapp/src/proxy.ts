import { NextResponse, type NextRequest } from "next/server";

import { isGuestBrowsablePage } from "@/config/guestBrowsing.config";
import { resolveLegacyPublicPathRedirect } from "@/server/legacyRedirects.service";
import { buildContentSecurityPolicyHeaderValue } from "@/server/contentSecurityPolicy.service";
import { readApiTokensFromCookies, readCachedViewerFromCookies, readSessionIdFromCookies } from "@/server/session.service";

const publicPagePaths = new Set(["/welcome", "/login", "/signup", "/forgot-password", "/reset-password"]);
const sessionFreePagePaths = new Set(["/security-check"]);
const staticAssetPattern = /\.(?:webp|png|jpe?g|gif|svg|ico|woff2?|txt|map|json|xml|webmanifest)$/i;

function redirectTo(request: NextRequest, pathname: string, searchParams?: Record<string, string>): NextResponse {
  const targetUrl = new URL(pathname, request.nextUrl.origin);
  for (const [name, value] of Object.entries(searchParams ?? {})) targetUrl.searchParams.set(name, value);
  return NextResponse.redirect(targetUrl, 307);
}

export async function proxy(request: NextRequest) {
  const response = await routeRequest(request);
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicyHeaderValue({ isIdentityVerification: request.nextUrl.pathname === "/settings/verification" }));
  return response;
}

async function routeRequest(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const requestedPathWithQuery = `${pathname}${search}`;
  const sessionId = readSessionIdFromCookies(request.cookies);

  if (staticAssetPattern.test(pathname) || sessionFreePagePaths.has(pathname)) return NextResponse.next();

  const legacyRedirectPath = await resolveLegacyPublicPathRedirect(pathname);
  if (legacyRedirectPath) return NextResponse.redirect(new URL(`${legacyRedirectPath}${search}`, request.nextUrl.origin), 308);

  if (publicPagePaths.has(pathname)) {
    if (sessionId && readCachedViewerFromCookies(request.cookies)) return redirectTo(request, "/", undefined);
    return NextResponse.next();
  }

  if (!sessionId) {
    if (isGuestBrowsablePage(pathname)) return NextResponse.next();
    return redirectTo(request, "/login", { next: requestedPathWithQuery });
  }
  if (!readCachedViewerFromCookies(request.cookies) || !readApiTokensFromCookies(request.cookies).accessToken) {
    return redirectTo(request, "/bff/auth/access-refresh", { next: requestedPathWithQuery });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!bff|_next/static|_next/image|favicon\\.ico|robots\\.txt|embed(?:/|$)|oembed(?:/|$)).*)"],
};
