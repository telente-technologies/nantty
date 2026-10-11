import { NextResponse, type NextRequest } from "next/server";

import { isClientAddressAllowedForAdmin } from "@/config/adminEnvironment.config";
import { findRequirementForPagePath, navigationGroups } from "@/config/navigation.config";
import { isCachedSessionViewStale, nowInEpochSeconds, readCachedSessionViewFromCookies, readSessionEnvelopeFromCookies, writeCachedSessionViewCookie } from "@/server/adminSession.service";
import { buildContentSecurityPolicyHeaderValue, createContentSecurityPolicyNonce } from "@/server/contentSecurityPolicy.service";
import { readClientIpAddress } from "@/server/requestOriginGuard.service";
import type { SignedInAdmin } from "@/types/admin.type";
import { doesAdminMeetPageRequirement } from "@/utils/adminAccess.util";

const publicPagePaths = new Set(["/login", "/login/mfa", "/restricted"]);

function redirectTo(request: NextRequest, pathname: string, searchParams: Record<string, string> = {}): NextResponse {
  const targetUrl = new URL(pathname, request.nextUrl.origin);
  for (const [name, value] of Object.entries(searchParams)) targetUrl.searchParams.set(name, value);
  return NextResponse.redirect(targetUrl, 307);
}

function findFirstPagePermittedForAdmin(admin: SignedInAdmin): string {
  for (const group of navigationGroups) {
    const permittedItem = group.items.find((item) => doesAdminMeetPageRequirement(admin, item.requirement));
    if (permittedItem) return permittedItem.href;
  }
  return "/account/security";
}

function continueWithSecurityHeaders(request: NextRequest): NextResponse {
  const nonce = createContentSecurityPolicyNonce();
  const policy = buildContentSecurityPolicyHeaderValue(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function isClientAddressAllowed(request: NextRequest): boolean {
  return isClientAddressAllowedForAdmin(readClientIpAddress(request));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isClientAddressAllowed(request)) {
    if (pathname === "/restricted" || pathname.startsWith("/bff")) return pathname === "/restricted" ? continueWithSecurityHeaders(request) : NextResponse.json({ code: "IP_NOT_ALLOWED", message: "This network is not on the admin allow-list." }, { status: 403 });
    return redirectTo(request, "/restricted");
  }
  if (pathname.startsWith("/bff")) return NextResponse.next();

  const envelope = readSessionEnvelopeFromCookies(request.cookies);
  const view = envelope ? readCachedSessionViewFromCookies(request.cookies) : null;
  if (publicPagePaths.has(pathname)) {
    if (pathname.startsWith("/login") && view) return redirectTo(request, findFirstPagePermittedForAdmin(view.admin));
    return continueWithSecurityHeaders(request);
  }
  const requestedPathWithQuery = `${pathname}${search}`;
  if (!envelope) return redirectTo(request, "/login", pathname === "/" ? {} : { next: requestedPathWithQuery });
  if (!view) return redirectTo(request, "/bff/auth/signed-out", { reason: "idle", next: requestedPathWithQuery });
  if (isCachedSessionViewStale(view)) return redirectTo(request, "/bff/auth/session-refresh", { next: requestedPathWithQuery });
  if (pathname === "/") return redirectTo(request, findFirstPagePermittedForAdmin(view.admin));

  const requirement = findRequirementForPagePath(pathname);
  if (!requirement || !doesAdminMeetPageRequirement(view.admin, requirement)) {
    return redirectTo(request, findFirstPagePermittedForAdmin(view.admin), { denied: pathname });
  }
  const response = continueWithSecurityHeaders(request);
  writeCachedSessionViewCookie(response.cookies, { ...view, lastActivityAtEpochSeconds: nowInEpochSeconds() });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icons|brand|manifest\\.webmanifest|favicon\\.ico|robots\\.txt).*)",
  ],
};
