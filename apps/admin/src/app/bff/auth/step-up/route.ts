import type { NextRequest } from "next/server";

import { sendJsonToAdminBackend } from "@/server/adminApiTransport.service";
import { readApiTokensFromCookies, readCachedSessionViewFromCookies, readSessionEnvelopeFromCookies, writeStepUpGrantCookie } from "@/server/adminSession.service";
import { respondWithBackendError, respondWithBffError, respondWithJson } from "@/server/bffResponses.service";
import { isMutationProtectedAgainstCsrf, readClientIpAddress } from "@/server/requestOriginGuard.service";

interface StepUpResponse {
  readonly stepUpToken: string;
  readonly expiresIn: number;
}

export async function POST(request: NextRequest) {
  const envelope = readSessionEnvelopeFromCookies(request.cookies);
  if (!envelope || !readCachedSessionViewFromCookies(request.cookies)) return respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  const body = (await request.json().catch(() => null)) as { method?: unknown; code?: unknown; credential?: unknown } | null;
  const method = body?.method === "webauthn" ? "webauthn" : "totp";
  const code = typeof body?.code === "string" ? body.code.replace(/\s+/g, "") : "";
  if (method === "totp" && !/^\d{6}$/.test(code)) return respondWithBffError(400, "VALIDATION_FAILED", "Enter the 6-digit code from your authenticator app.");
  const { accessToken } = readApiTokensFromCookies(request.cookies);
  const clientAddress = readClientIpAddress(request);
  const result = await sendJsonToAdminBackend<StepUpResponse>(
    "POST",
    "/admin/auth/step-up",
    method === "totp" ? { code } : { method, credential: body?.credential },
    { accessToken, forwardedHeaders: clientAddress ? { "X-Forwarded-For": clientAddress } : {} },
  );
  if (!result.body) return respondWithBackendError(result.status, result.error, "That code did not work. Try the newest code.");
  const response = respondWithJson({ confirmedForSeconds: Math.min(result.body.expiresIn, 300) });
  writeStepUpGrantCookie(response.cookies, { sessionId: envelope.sessionId, stepUpToken: result.body.stepUpToken }, result.body.expiresIn);
  return response;
}
