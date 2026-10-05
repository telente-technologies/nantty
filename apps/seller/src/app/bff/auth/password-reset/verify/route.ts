import { NextResponse, type NextRequest } from "next/server";

import { respondWithBffError } from "@/server/bffGateway.service";
import { normaliseResetEmailAddress, writePasswordResetTokenCookie } from "@/server/passwordReset.service";
import { isRequestFromDashboardOrigin } from "@/server/requestOriginGuard.service";
import { callSellerBackend, encodeJsonRequestBody, readJsonFromBackendResult } from "@/server/sellerApiTransport.service";

export async function POST(request: NextRequest) {
  if (!isRequestFromDashboardOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const body = (await request.json().catch(() => null)) as { destination?: unknown; code?: unknown } | null;
  const destination = normaliseResetEmailAddress(body?.destination);
  const code = typeof body?.code === "string" && /^\d{6}$/.test(body.code.trim()) ? body.code.trim() : null;
  if (!destination || !code) return respondWithBffError(400, "VALIDATION_FAILED", "Enter the 6-digit code we sent you.");
  const result = await callSellerBackend({ method: "POST", path: "/auth/otp/verify", body: encodeJsonRequestBody({ destination, code, purpose: "reset" }), contentType: "application/json" });
  const verified = result.status === 200 ? readJsonFromBackendResult<{ otpToken?: string }>(result) : null;
  if (!verified?.otpToken) {
    return respondWithBffError(result.status === 429 ? 429 : 400, "CODE_INVALID", result.status === 429 ? "Too many attempts. Request a new code in a few minutes." : "That code is not right or has expired.");
  }
  const response = NextResponse.json({ verified: true }, { headers: { "Cache-Control": "no-store" } });
  writePasswordResetTokenCookie(response, verified.otpToken);
  return response;
}
