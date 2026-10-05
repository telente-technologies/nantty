import { NextResponse, type NextRequest } from "next/server";

import { findFirstPageAllowedForAccess } from "@/config/rolePermissions.config";
import { respondWithBffError } from "@/server/bffGateway.service";
import { applyRotatedTokensToResponse, callBackendAsSignedInSeller } from "@/server/authenticatedBackendCall.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";
import { renewSellerAccessCache, writeRenewedSessionCookies } from "@/server/sellerAuthentication.service";
import { readJsonFromBackendResult } from "@/server/sellerApiTransport.service";
import { clearStoreScopedCookies, readApiTokensFromCookies, readCachedSellerAccessFromCookies, readSessionIdFromCookies, writeSelectedStoreCookie } from "@/server/sellerSession.service";
import { readMyStoreEntries, type MyStoresResponse } from "@/utils/myStores.util";
import { decideSellerAccessDestination, gatePagePathByDestination } from "@/utils/sellerAccessDestination.util";

export async function POST(request: NextRequest) {
  const sessionId = readSessionIdFromCookies(request.cookies);
  if (!sessionId) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const body = (await request.json().catch(() => null)) as { storeId?: unknown } | null;
  const storeId = typeof body?.storeId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(body.storeId) ? body.storeId : null;
  if (!storeId) return respondWithBffError(400, "VALIDATION_FAILED", "Choose one of your stores.");

  const outcome = await callBackendAsSignedInSeller(request, { method: "GET", path: "/seller/stores/mine", storeId });
  const myStores = readMyStoreEntries(readJsonFromBackendResult<MyStoresResponse>(outcome.result));
  if (!myStores.some((store) => store.storeId === storeId)) return respondWithBffError(404, "STORE_NOT_FOUND", "You are not a member of that store.");

  const tokens = readApiTokensFromCookies(request.cookies);
  const renewed = await renewSellerAccessCache({
    sessionId,
    accessToken: outcome.rotatedTokens?.accessToken ?? tokens.accessToken,
    refreshToken: outcome.rotatedTokens?.refreshToken ?? tokens.refreshToken,
    knownUser: readCachedSellerAccessFromCookies(request.cookies)?.user ?? null,
    storeId,
  });
  if (!renewed) return respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
  const destination = decideSellerAccessDestination(renewed.cachedAccess.access);
  const redirectTo = destination === "app" ? findFirstPageAllowedForAccess(renewed.cachedAccess.access) : gatePagePathByDestination[destination];
  const response = NextResponse.json({ storeId, redirectTo }, { headers: { "Cache-Control": "no-store" } });
  clearStoreScopedCookies(response);
  writeSelectedStoreCookie(response, sessionId, storeId);
  applyRotatedTokensToResponse(response, outcome);
  writeRenewedSessionCookies(response, renewed);
  return response;
}
