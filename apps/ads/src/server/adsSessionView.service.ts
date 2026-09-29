import {
  readCachedSessionViewFromCookies,
  readSessionIdFromCookies,
  type CookieReader,
} from "@/server/adsSession.service";
import { deriveCsrfTokenForSession } from "@/server/signedCookie.service";
import type { AdsSessionView } from "@/types/session.type";

export function buildSessionViewFromCookies(
  cookies: CookieReader,
): AdsSessionView | null {
  const cachedView = readCachedSessionViewFromCookies(cookies);
  return cachedView
    ? { user: cachedView.user, memberships: cachedView.memberships }
    : null;
}

export function readCsrfTokenForCookies(cookies: CookieReader): string | null {
  const sessionId = readSessionIdFromCookies(cookies);
  return sessionId ? deriveCsrfTokenForSession(sessionId) : null;
}
