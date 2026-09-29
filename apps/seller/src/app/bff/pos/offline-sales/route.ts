import { NextResponse, type NextRequest } from "next/server";

import { respondWithBffError } from "@/server/bffGateway.service";
import { applyRotatedTokensToResponse, callBackendAsSignedInSeller } from "@/server/authenticatedBackendCall.service";
import { openOfflineOperatorPassForSession } from "@/server/offlineOperatorPass.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";
import { encodeJsonRequestBody } from "@/server/sellerApiTransport.service";
import { readCachedSellerAccessFromCookies, readPosOperatorFromCookies, readSessionIdFromCookies } from "@/server/sellerSession.service";

const identifierPattern = /^[A-Za-z0-9_-]{1,128}$/;

export async function POST(request: NextRequest) {
  const sessionId = readSessionIdFromCookies(request.cookies);
  if (!sessionId) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const body = (await request.json().catch(() => null)) as { storeId?: unknown; operatorPass?: unknown; sale?: unknown } | null;
  const storeId = typeof body?.storeId === "string" && identifierPattern.test(body.storeId) ? body.storeId : null;
  const sale = typeof body?.sale === "object" && body.sale !== null && !Array.isArray(body.sale) ? (body.sale as Record<string, unknown>) : null;
  const clientSaleId = typeof sale?.clientSaleId === "string" && identifierPattern.test(sale.clientSaleId) ? sale.clientSaleId : null;
  const locationId = typeof sale?.locationId === "string" && identifierPattern.test(sale.locationId) ? sale.locationId : null;
  if (!storeId || !sale || !clientSaleId || !locationId || typeof sale.offlineCreatedAt !== "string") return respondWithBffError(400, "VALIDATION_FAILED", "This offline sale is incomplete.");

  const operatorPass = openOfflineOperatorPassForSession(body?.operatorPass, sessionId, storeId);
  const isCurrentStore = readCachedSellerAccessFromCookies(request.cookies)?.access.storeId === storeId;
  const operatorToken = operatorPass?.operatorToken ?? (isCurrentStore ? readPosOperatorFromCookies(request.cookies)?.operatorToken ?? null : null);
  const outcome = await callBackendAsSignedInSeller(request, {
    method: "POST",
    path: "/seller/pos/sales",
    body: encodeJsonRequestBody(sale),
    contentType: "application/json",
    storeId,
    locationId,
    operatorToken,
    forwardedHeaders: { "Idempotency-Key": clientSaleId },
  });
  const response = new NextResponse(outcome.result.body.byteLength > 0 ? Buffer.from(outcome.result.body) : null, {
    status: outcome.result.status,
    headers: { "Cache-Control": "no-store", "Content-Type": outcome.result.headers.get("content-type") ?? "application/json" },
  });
  applyRotatedTokensToResponse(response, outcome);
  return response;
}
