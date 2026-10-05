import { NextResponse, type NextRequest } from "next/server";

import { doesAccessGrantPermission, findFirstPageAllowedForAccess, findPermissionRequiredForPage } from "@/config/rolePermissions.config";
import { readCachedSellerAccessFromCookies, readSessionIdFromCookies } from "@/server/sellerSession.service";
import { decideSellerAccessDestination, gatePagePathByDestination } from "@/utils/sellerAccessDestination.util";

const publicPagePaths = new Set(["/login", "/forgot-password"]);

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
    if ((pathname === "/login" || pathname === "/forgot-password") && sessionId && readCachedSellerAccessFromCookies(request.cookies)) return redirectTo(request, "/");
    return NextResponse.next();
  }
  if (!sessionId) return pathname === "/" ? NextResponse.next() : redirectTo(request, "/login", { next: requestedPathWithQuery });

  const cachedAccess = readCachedSellerAccessFromCookies(request.cookies);
  if (!cachedAccess) return redirectTo(request, "/bff/auth/access-refresh", { next: requestedPathWithQuery });

  const destination = decideSellerAccessDestination(cachedAccess.access);
  const isGatePage = pathname === "/access" || pathname.startsWith("/access/");
  const isBillingCheckoutPage = pathname.startsWith("/billing-checkout/");
  if (isBillingCheckoutPage) return destination === "app" ? NextResponse.next() : redirectTo(request, gatePagePathByDestination[destination]);
  if (destination !== "app") {
    const gatePath = gatePagePathByDestination[destination];
    const isAllowedGatePage = pathname === gatePath || pathname.startsWith(`${gatePath}/`);
    return isAllowedGatePage ? NextResponse.next() : redirectTo(request, gatePath);
  }

  if (pathname === "/" || isGatePage) return redirectTo(request, findFirstPageAllowedForAccess(cachedAccess.access));
  const requiredPermission = findPermissionRequiredForPage(pathname);
  if (requiredPermission && !doesAccessGrantPermission(cachedAccess.access, requiredPermission)) {
    const fallbackPath = findFirstPageAllowedForAccess(cachedAccess.access);
    return fallbackPath === pathname ? NextResponse.next() : redirectTo(request, fallbackPath, { denied: pathname });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!bff|_next/static|_next/image|icons|brand|images|photos|screenshots|serviceWorker\\.js|manifest\\.webmanifest|favicon\\.ico|robots\\.txt).*)"],
};
