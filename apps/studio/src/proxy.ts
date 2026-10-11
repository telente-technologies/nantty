import { NextResponse, type NextRequest } from "next/server";

import { readApiTokensFromCookies, readCachedViewerFromCookies, readSessionIdFromCookies } from "@/server/session.service";

const publicPagePaths = new Set(["/", "/login"]);
const homePath = "/";
const studioHomePath = "/home";
const staticAssetPattern = /\.(?:webp|png|jpe?g|gif|svg|ico|woff2?|txt|map|json|xml|webmanifest)$/i;

function isOverlayBrowserSourcePath(pathname: string): boolean {
  return pathname === "/overlay" || pathname.startsWith("/overlay/");
}

function redirectTo(request: NextRequest, pathname: string, searchParams?: Record<string, string>): NextResponse {
  const targetUrl = new URL(pathname, request.nextUrl.origin);
  for (const [name, value] of Object.entries(searchParams ?? {})) targetUrl.searchParams.set(name, value);
  return NextResponse.redirect(targetUrl, 307);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestedPathWithQuery = `${pathname}${search}`;
  const sessionId = readSessionIdFromCookies(request.cookies);

  if (staticAssetPattern.test(pathname)) return NextResponse.next();

  if (isOverlayBrowserSourcePath(pathname)) return NextResponse.next();

  if (publicPagePaths.has(pathname)) {
    if (sessionId && readCachedViewerFromCookies(request.cookies)) return redirectTo(request, studioHomePath);
    if (sessionId) return redirectTo(request, "/bff/auth/access-refresh", { next: studioHomePath });
    return NextResponse.next();
  }

  if (!sessionId) return redirectTo(request, "/login", pathname === homePath ? undefined : { next: requestedPathWithQuery });
  if (!readCachedViewerFromCookies(request.cookies) || !readApiTokensFromCookies(request.cookies).accessToken) {
    return redirectTo(request, "/bff/auth/access-refresh", { next: requestedPathWithQuery });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!bff|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)"],
};
