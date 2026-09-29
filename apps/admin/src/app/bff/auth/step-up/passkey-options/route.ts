import type { NextRequest } from "next/server";

import { sendJsonToAdminBackend } from "@/server/adminApiTransport.service";
import { readApiTokensFromCookies, readCachedSessionViewFromCookies } from "@/server/adminSession.service";
import { respondWithBackendError, respondWithBffError, respondWithJson } from "@/server/bffResponses.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";

export async function POST(request: NextRequest) {
  if (!readCachedSessionViewFromCookies(request.cookies)) return respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  const result = await sendJsonToAdminBackend<Record<string, unknown>>("POST", "/admin/auth/step-up/webauthn/options", undefined, { accessToken: readApiTokensFromCookies(request.cookies).accessToken });
  if (!result.body) return respondWithBackendError(result.status, result.error, "Passkey confirmation is not available.");
  return respondWithJson(result.body);
}
