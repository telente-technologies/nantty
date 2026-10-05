import type { NextRequest } from "next/server";

import { sendJsonToAdminBackend } from "@/server/adminApiTransport.service";
import { readPendingMfaChallengeFromCookies } from "@/server/adminSession.service";
import { respondWithBackendError, respondWithBffError, respondWithJson } from "@/server/bffResponses.service";
import { isRequestFromAdminConsoleOrigin } from "@/server/requestOriginGuard.service";

interface EnrollmentSecretResponse {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly issuer?: string;
  readonly accountName?: string;
}

export async function POST(request: NextRequest) {
  if (!isRequestFromAdminConsoleOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const challenge = readPendingMfaChallengeFromCookies(request.cookies);
  if (!challenge?.enrollmentRequired) return respondWithBffError(401, "MFA_CHALLENGE_EXPIRED", "Your sign-in step expired. Enter your password again.");
  const result = await sendJsonToAdminBackend<EnrollmentSecretResponse>("POST", "/admin/auth/mfa/enroll/start", { challengeToken: challenge.mfaToken });
  if (!result.body) return respondWithBackendError(result.status, result.error, "Could not start authenticator setup.");
  return respondWithJson({ issuer: "Zudomart Admin", accountName: challenge.email, ...result.body });
}
