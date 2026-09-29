import { isMockBackendEnabled, readAdminDeploymentEnvironment } from "@/config/adminEnvironment.config";
import { sessionLifetimesInSeconds } from "@/config/sessionCookies.config";
import { readCachedSessionViewFromCookies, readSessionEnvelopeFromCookies, type CookieReader } from "@/server/adminSession.service";
import { deriveCsrfTokenForSession } from "@/server/signedCookie.service";
import type { AdminSessionView } from "@/types/admin.type";

export function buildAdminSessionViewFromCookies(cookies: CookieReader): AdminSessionView | null {
  const envelope = readSessionEnvelopeFromCookies(cookies);
  const view = envelope ? readCachedSessionViewFromCookies(cookies) : null;
  if (!envelope || !view) return null;
  return {
    admin: view.admin,
    sessionStartedAtEpochSeconds: envelope.startedAtEpochSeconds,
    lastActivityAtEpochSeconds: view.lastActivityAtEpochSeconds,
    idleTimeoutSeconds: sessionLifetimesInSeconds.idle,
    absoluteTimeoutSeconds: sessionLifetimesInSeconds.absoluteSession,
    environment: readAdminDeploymentEnvironment(),
    isMockBackend: isMockBackendEnabled(),
  };
}

export function readCsrfTokenForCookies(cookies: CookieReader): string | null {
  const envelope = readSessionEnvelopeFromCookies(cookies);
  return envelope ? deriveCsrfTokenForSession(envelope.sessionId) : null;
}
