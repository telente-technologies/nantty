import { NextResponse, type NextRequest } from "next/server";

import { buildContentSecurityPolicyHeaderValue } from "@/server/contentSecurityPolicy.service";
import { doesRoleHavePermission, findPermissionRequiredForPage, readAccountIdFromPagePath } from "@/config/rolePermissions.config";
import { readCachedSessionViewFromCookies, readSessionIdFromCookies } from "@/server/adsSession.service";

const publicPagePaths = new Set(["/", "/login", "/policy"]);
const accountPathsThatAreNotAccountIds = new Set(["new"]);

function redirectTo(request: NextRequest, pathname: string, searchParams?: Record<string, string>): NextResponse {
  const targetUrl = new URL(pathname, request.nextUrl.origin);
  for (const [name, value] of Object.entries(searchParams ?? {})) targetUrl.searchParams.set(name, value);
  return NextResponse.redirect(targetUrl, 307);
}

export function proxy(request: NextRequest) {
  const response = routeRequest(request);
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicyHeaderValue());
  return response;
}

function routeRequest(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const requestedPathWithQuery = `${pathname}${search}`;
  const sessionId = readSessionIdFromCookies(request.cookies);
  const cachedView = sessionId ? readCachedSessionViewFromCookies(request.cookies) : null;

  if (publicPagePaths.has(pathname)) {
    if (pathname === "/login" && cachedView) return redirectTo(request, "/accounts");
    return NextResponse.next();
  }
  if (!sessionId) return redirectTo(request, "/login", pathname === "/" ? {} : { next: requestedPathWithQuery });
  if (!cachedView) return redirectTo(request, "/bff/auth/session-refresh", { next: requestedPathWithQuery });

  const accountId = readAccountIdFromPagePath(pathname);
  if (!accountId || accountPathsThatAreNotAccountIds.has(accountId)) return NextResponse.next();
  const membership = cachedView.memberships.find((candidate) => candidate.accountId === accountId);
  if (!membership) {
    if (request.nextUrl.searchParams.has("membershipChecked")) return redirectTo(request, "/accounts", { denied: accountId });
    const nextPath = new URL(requestedPathWithQuery, request.nextUrl.origin);
    nextPath.searchParams.set("membershipChecked", "1");
    return redirectTo(request, "/bff/auth/session-refresh", { next: `${nextPath.pathname}${nextPath.search}` });
  }
  const requiredPermission = findPermissionRequiredForPage(pathname);
  if (requiredPermission && !doesRoleHavePermission(membership.role, requiredPermission)) {
    return redirectTo(request, `/accounts/${accountId}/overview`, { denied: pathname });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!bff|_next/static|_next/image|icons|brand|images|screenshots|manifest\\.webmanifest|favicon\\.ico|robots\\.txt).*)"],
};
