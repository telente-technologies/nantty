import type { NextRequest } from "next/server";

import { sendJsonToAdminBackend } from "@/server/adminApiTransport.service";
import { readPendingMfaChallengeFromCookies } from "@/server/adminSession.service";
import { respondWithBackendError, respondWithBffError, respondWithJson } from "@/server/bffResponses.service";
import { isRequestFromAdminConsoleOrigin } from "@/server/requestOriginGuard.service";

export async function POST(request: NextRequest) {
  if (!isRequestFromAdminConsoleOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const challenge = readPendingMfaChallengeFromCookies(request.cookies);
  if (!challenge || challenge.enrollmentRequired) return respondWithBffError(401, "MFA_CHALLENGE_EXPIRED", "Your sign-in step expired. Enter your password again.");
  const result = await sendJsonToAdminBackend<Record<string, unknown>>("POST", "/admin/auth/mfa/webauthn/options", { mfaToken: challenge.mfaToken });
  if (!result.body) return respondWithBackendError(result.status, result.error, "Passkey sign-in is not available.");
  return respondWithJson(result.body);
}
