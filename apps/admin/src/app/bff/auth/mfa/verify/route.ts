import type { NextRequest } from "next/server";

import { sessionCookieNames } from "@/config/sessionCookies.config";
import { convertCurrentAdminResponse, establishNewAdminSession } from "@/server/adminAuthentication.service";
import { sendJsonToAdminBackend } from "@/server/adminApiTransport.service";
import { clearCookieByName, readPendingMfaChallengeFromCookies, type ApiTokenPair } from "@/server/adminSession.service";
import { respondWithBackendError, respondWithBffError, respondWithJson } from "@/server/bffResponses.service";
import { isRequestFromAdminConsoleOrigin, readClientIpAddress, readClientUserAgent } from "@/server/requestOriginGuard.service";

interface MfaVerifiedResponse extends ApiTokenPair {
  readonly staff?: Parameters<typeof convertCurrentAdminResponse>[0];
  readonly admin?: Parameters<typeof convertCurrentAdminResponse>[0];
  readonly recoveryCodes?: readonly string[];
}

export async function POST(request: NextRequest) {
  if (!isRequestFromAdminConsoleOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const challenge = readPendingMfaChallengeFromCookies(request.cookies);
  if (!challenge) return respondWithBffError(401, "MFA_CHALLENGE_EXPIRED", "Your sign-in step expired. Enter your password again.");
  const body = (await request.json().catch(() => null)) as { method?: unknown; code?: unknown; credential?: unknown } | null;
  const method = body?.method === "webauthn" ? "webauthn" : body?.method === "recovery" ? "recovery" : "totp";
  const code = typeof body?.code === "string" ? body.code.replace(/\s+/g, "") : "";
  if (method === "totp" && !/^\d{6}$/.test(code)) return respondWithBffError(400, "VALIDATION_FAILED", "Enter the 6-digit code from your authenticator app.");
  if (method === "recovery" && !/^[A-Za-z0-9-]{8,20}$/.test(code)) return respondWithBffError(400, "VALIDATION_FAILED", "Enter one of your recovery codes.");
  if (method === "webauthn" && (typeof body?.credential !== "object" || body.credential === null)) return respondWithBffError(400, "VALIDATION_FAILED", "The passkey response was empty.");

  const forwardedHeaders: Record<string, string> = { "User-Agent": readClientUserAgent(request) };
  const clientAddress = readClientIpAddress(request);
  if (clientAddress) forwardedHeaders["X-Forwarded-For"] = clientAddress;
  const result = challenge.enrollmentRequired
    ? await sendJsonToAdminBackend<MfaVerifiedResponse>("POST", "/admin/auth/mfa/enroll/confirm", { challengeToken: challenge.mfaToken, code }, { forwardedHeaders })
    : await sendJsonToAdminBackend<MfaVerifiedResponse>("POST", "/admin/auth/mfa/verify", method === "webauthn" ? { challengeToken: challenge.mfaToken, method, credential: body?.credential } : { challengeToken: challenge.mfaToken, code }, { forwardedHeaders });
  if (!result.body) {
    if (result.status === 429) return respondWithBffError(429, "RATE_LIMITED", "Too many codes tried. Wait a minute and try again.");
    return respondWithBackendError(result.status, result.error, "That code did not work. Try the newest code.");
  }
  const signedInAdmin = result.body.staff ?? result.body.admin;
  if (!signedInAdmin) return respondWithBffError(502, "UPSTREAM_INVALID_RESPONSE", "Sign-in failed. Try again.");
  const response = respondWithJson({ redirectTo: challenge.nextPath, recoveryCodes: result.body.recoveryCodes ?? null });
  clearCookieByName(response.cookies, sessionCookieNames.pendingMfa);
  establishNewAdminSession(response.cookies, result.body, convertCurrentAdminResponse(signedInAdmin));
  return response;
}
