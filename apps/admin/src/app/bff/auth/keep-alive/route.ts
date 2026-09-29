import type { NextRequest } from "next/server";

import { nowInEpochSeconds, readCachedSessionViewFromCookies, writeCachedSessionViewCookie } from "@/server/adminSession.service";
import { respondWithBffError, respondWithJson } from "@/server/bffResponses.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";

export async function POST(request: NextRequest) {
  const view = readCachedSessionViewFromCookies(request.cookies);
  if (!view) return respondWithBffError(401, "SESSION_IDLE_TIMEOUT", "You were signed out after 15 minutes without activity.");
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  const now = nowInEpochSeconds();
  const response = respondWithJson({ lastActivityAtEpochSeconds: now });
  writeCachedSessionViewCookie(response.cookies, { ...view, lastActivityAtEpochSeconds: now });
  return response;
}
