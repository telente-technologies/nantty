import { NextResponse, type NextRequest } from "next/server";

import { respondWithBffError } from "@/server/bffGateway.service";
import { applyRotatedTokensToResponse, callBackendAsSignedInSeller } from "@/server/authenticatedBackendCall.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";
import { readJsonFromBackendResult } from "@/server/sellerApiTransport.service";
import { readSessionIdFromCookies, writeSelectedLocationCookie } from "@/server/sellerSession.service";
import type { CursorPage } from "@/types/pagination.type";
import type { StoreLocation } from "@/types/store.type";

export async function POST(request: NextRequest) {
  if (!readSessionIdFromCookies(request.cookies)) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const body = (await request.json().catch(() => null)) as { locationId?: unknown } | null;
  const locationId = typeof body?.locationId === "string" ? body.locationId : "";
  const outcome = await callBackendAsSignedInSeller(request, { method: "GET", path: "/seller/locations" });
  const locations = readJsonFromBackendResult<CursorPage<StoreLocation>>(outcome.result)?.data ?? [];
  if (!locations.some((location) => location.id === locationId && location.active)) return respondWithBffError(404, "LOCATION_NOT_FOUND", "Choose one of your active locations.");
  const response = NextResponse.json({ locationId }, { headers: { "Cache-Control": "no-store" } });
  writeSelectedLocationCookie(response, locationId);
  applyRotatedTokensToResponse(response, outcome);
  return response;
}
