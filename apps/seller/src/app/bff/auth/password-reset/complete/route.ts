import { NextResponse, type NextRequest } from "next/server";

import { respondWithBffError } from "@/server/bffGateway.service";
import { clearPasswordResetTokenCookie, describeNewPasswordProblem, readPasswordResetTokenFromCookie } from "@/server/passwordReset.service";
import { isRequestFromDashboardOrigin } from "@/server/requestOriginGuard.service";
import { callSellerBackend, encodeJsonRequestBody } from "@/server/sellerApiTransport.service";

export async function POST(request: NextRequest) {
  if (!isRequestFromDashboardOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const otpToken = readPasswordResetTokenFromCookie(request);
  if (!otpToken) return respondWithBffError(400, "RESET_EXPIRED", "Your reset session expired. Start again.");
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const passwordProblem = describeNewPasswordProblem(password);
  if (passwordProblem) return respondWithBffError(400, "VALIDATION_FAILED", passwordProblem);
  const result = await callSellerBackend({ method: "POST", path: "/auth/password/reset", body: encodeJsonRequestBody({ otpToken, password }), contentType: "application/json" });
  if (result.status !== 200 && result.status !== 204) {
    const response = respondWithBffError(400, "RESET_FAILED", "We could not change your password. Start again.");
    clearPasswordResetTokenCookie(response);
    return response;
  }
  const response = new NextResponse(null, { status: 204 });
  clearPasswordResetTokenCookie(response);
  return response;
}
