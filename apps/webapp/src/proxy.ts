import { NextResponse, type NextRequest } from "next/server";

import { readApiTokensFromCookies, readCachedViewerFromCookies, readSessionIdFromCookies } from "@/server/session.service";

const publicPagePaths = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

function redirectTo(request: NextRequest, pathname: string, searchParams?: Record<string, string>): NextResponse {
  const targetUrl = new URL(pathname, request.nextUrl.origin);
  for (const [name, value] of Object.entries(searchParams ?? {})) targetUrl.searchParams.set(name, value);
  return NextResponse.redirect(targetUrl, 307);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestedPathWithQuery = `${pathname}${search}`;
  const sessionId = readSessionIdFromCookies(request.cookies);

  if (publicPagePaths.has(pathname)) {
    if ((pathname === "/login" || pathname === "/signup") && sessionId && readCachedViewerFromCookies(request.cookies)) {
      return redirectTo(request, "/bff/auth/access-refresh", { next: requestedPathWithQuery });
    }
    return NextResponse.next();
  }

  if (!sessionId) return redirectTo(request, "/login", pathname === "/" ? undefined : { next: requestedPathWithQuery });
  if (!readCachedViewerFromCookies(request.cookies) || !readApiTokensFromCookies(request.cookies).accessToken) {
    return redirectTo(request, "/bff/auth/access-refresh", { next: requestedPathWithQuery });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!bff|_next/static|_next/image|icons|images|favicon\\.ico|robots\\.txt).*)"],
};
