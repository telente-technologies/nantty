import { readCachedSellerAccessFromCookies, readPosOperatorFromCookies, readSelectedLocationIdFromCookies, readSessionIdFromCookies, type CookieReader } from "@/server/sellerSession.service";
import { deriveCsrfTokenForSession } from "@/server/signedCookie.service";
import type { SellerSessionView } from "@/types/sellerAccess.type";

export function buildSellerSessionViewFromCookies(cookies: CookieReader): SellerSessionView | null {
  const cachedAccess = readCachedSellerAccessFromCookies(cookies);
  if (!cachedAccess) return null;
  const operator = readPosOperatorFromCookies(cookies)?.operator ?? null;
  return {
    user: cachedAccess.user,
    access: cachedAccess.access,
    operator,
    effectiveRole: operator?.role ?? cachedAccess.access.role,
    selectedLocationId: readSelectedLocationIdFromCookies(cookies),
  };
}

export function readCsrfTokenForCookies(cookies: CookieReader): string | null {
  const sessionId = readSessionIdFromCookies(cookies);
  return sessionId ? deriveCsrfTokenForSession(sessionId) : null;
}
