import { NextResponse, type NextRequest } from "next/server";

import { callAdsBackend, encodeJsonRequestBody, readJsonFromBackendResult } from "@/server/adsApiTransport.service";
import { readApiTokensFromCookies, readSessionIdFromCookies } from "@/server/adsSession.service";
import { respondWithBffError } from "@/server/bffGateway.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";
import type { ApiErrorBody } from "@/types/api.type";

interface StepUpGrantBody {
  readonly stepUpToken: string;
  readonly expiresIn: number;
}

export async function POST(request: NextRequest) {
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  const { accessToken } = readApiTokensFromCookies(request.cookies);
  if (!readSessionIdFromCookies(request.cookies) || !accessToken) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 1 || password.length > 128) return respondWithBffError(400, "VALIDATION_FAILED", "Enter your password.");
  const result = await callAdsBackend({ method: "POST", path: "/auth/step-up", body: encodeJsonRequestBody({ password }), contentType: "application/json", accessToken });
  const granted = result.status === 200 ? readJsonFromBackendResult<StepUpGrantBody>(result) : null;
  if (!granted?.stepUpToken) {
    const errorBody = readJsonFromBackendResult<ApiErrorBody>(result);
    const status = result.status === 429 ? 429 : result.status >= 500 ? 502 : 401;
    return respondWithBffError(status, errorBody?.code ?? "STEP_UP_FAILED", status === 429 ? "Too many attempts. Wait a minute and try again." : errorBody?.message ?? "That password is not right.");
  }
  return NextResponse.json({ stepUpToken: granted.stepUpToken, expiresIn: granted.expiresIn }, { headers: { "Cache-Control": "no-store" } });
}
