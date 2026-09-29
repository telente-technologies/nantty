import { NextResponse, type NextRequest } from "next/server";

import { respondWithBffError } from "@/server/bffGateway.service";
import { applyRotatedTokensToResponse, callBackendAsSignedInSeller } from "@/server/authenticatedBackendCall.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";
import { encodeJsonRequestBody, readJsonFromBackendResult } from "@/server/sellerApiTransport.service";
import { sealOfflineOperatorPass } from "@/server/offlineOperatorPass.service";
import { clearPosOperatorCookie, readCachedSellerAccessFromCookies, readPosOperatorFromCookies, readSessionIdFromCookies, writePosOperatorCookie } from "@/server/sellerSession.service";
import type { ApiErrorBody } from "@/types/pagination.type";
import type { PosOperator } from "@/types/sellerAccess.type";

interface PinSessionResponse {
  readonly operatorToken: string;
  readonly operator: PosOperator;
  readonly expiresAt: string;
}

export async function POST(request: NextRequest) {
  const sessionId = readSessionIdFromCookies(request.cookies);
  if (!sessionId) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const body = (await request.json().catch(() => null)) as { staffId?: unknown; pin?: unknown; registerId?: unknown } | null;
  const staffId = typeof body?.staffId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(body.staffId) ? body.staffId : null;
  const pin = typeof body?.pin === "string" && /^\d{4,6}$/.test(body.pin) ? body.pin : null;
  if (!staffId || !pin) return respondWithBffError(400, "VALIDATION_FAILED", "Choose your name and enter your 4–6 digit PIN.");
  const registerId = typeof body?.registerId === "string" ? body.registerId.slice(0, 64) : null;

  const outcome = await callBackendAsSignedInSeller(request, { method: "POST", path: "/seller/staff/pin-sessions", body: encodeJsonRequestBody({ staffId, pin, registerId }), contentType: "application/json" });
  if (outcome.result.status !== 201 && outcome.result.status !== 200) {
    const errorBody = readJsonFromBackendResult<ApiErrorBody>(outcome.result);
    const response = respondWithBffError(outcome.result.status === 423 ? 423 : 403, errorBody?.code ?? "PIN_INCORRECT", errorBody?.message ?? "That PIN is not right.");
    applyRotatedTokensToResponse(response, outcome);
    return response;
  }
  const pinSession = readJsonFromBackendResult<PinSessionResponse>(outcome.result);
  if (!pinSession) return respondWithBffError(502, "BAD_UPSTREAM_RESPONSE", "Could not switch cashier. Try again.");
  const storeId = readCachedSellerAccessFromCookies(request.cookies)?.access.storeId ?? null;
  const offlineOperatorPass = storeId ? sealOfflineOperatorPass({ sessionId, storeId, staffId: pinSession.operator.staffId, operatorToken: pinSession.operatorToken }) : null;
  const response = NextResponse.json({ operator: pinSession.operator, storeId, offlineOperatorPass }, { headers: { "Cache-Control": "no-store" } });
  writePosOperatorCookie(response, { sessionId, operator: pinSession.operator, operatorToken: pinSession.operatorToken });
  applyRotatedTokensToResponse(response, outcome);
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const operator = readPosOperatorFromCookies(request.cookies);
  if (operator) {
    await callBackendAsSignedInSeller(request, { method: "DELETE", path: "/seller/staff/pin-sessions/current", operatorToken: operator.operatorToken });
  }
  const response = new NextResponse(null, { status: 204 });
  clearPosOperatorCookie(response);
  return response;
}
