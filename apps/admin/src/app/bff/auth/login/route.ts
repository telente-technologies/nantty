import type { NextRequest } from "next/server";

import { sendJsonToAdminBackend } from "@/server/adminApiTransport.service";
import { clearEverySessionCookie, writePendingMfaChallengeCookie } from "@/server/adminSession.service";
import { respondWithBackendError, respondWithBffError, respondWithJson } from "@/server/bffResponses.service";
import { isRequestFromAdminConsoleOrigin, readClientIpAddress, readClientUserAgent, readSafeRelativeRedirectPath } from "@/server/requestOriginGuard.service";

interface LoginChallengeResponse {
  readonly mfaToken: string;
  readonly enrollmentRequired: boolean;
  readonly passkeyAvailable: boolean;
}

export async function POST(request: NextRequest) {
  if (!isRequestFromAdminConsoleOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This sign-in request could not be verified.");
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown; next?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 1 || password.length > 256) {
    return respondWithBffError(400, "VALIDATION_FAILED", "Enter your work email and password.");
  }
  const forwardedHeaders: Record<string, string> = { "User-Agent": readClientUserAgent(request) };
  const clientAddress = readClientIpAddress(request);
  if (clientAddress) forwardedHeaders["X-Forwarded-For"] = clientAddress;

  const result = await sendJsonToAdminBackend<LoginChallengeResponse>("POST", "/admin/auth/login", { email, password }, { forwardedHeaders });
  if (!result.body) {
    if (result.status === 429) return respondWithBffError(429, "RATE_LIMITED", "Too many attempts. Wait a minute and try again.");
    if (result.status === 401) return respondWithBffError(401, "INVALID_CREDENTIALS", "That email and password do not match an admin account.");
    return respondWithBackendError(result.status, result.error, "Sign-in failed. Try again.");
  }
  const nextPath = readSafeRelativeRedirectPath(typeof body?.next === "string" ? body.next : null, "/");
  const response = respondWithJson({ step: result.body.enrollmentRequired ? "enroll" : "challenge" });
  clearEverySessionCookie(response.cookies);
  writePendingMfaChallengeCookie(response.cookies, { mfaToken: result.body.mfaToken, email, enrollmentRequired: result.body.enrollmentRequired, passkeyAvailable: result.body.passkeyAvailable === true, nextPath });
  return response;
}
