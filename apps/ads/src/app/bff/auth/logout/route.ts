import { NextResponse, type NextRequest } from "next/server";

import { callAdsBackend, encodeJsonRequestBody } from "@/server/adsApiTransport.service";
import { clearEverySessionCookie, readApiTokensFromCookies } from "@/server/adsSession.service";
import { respondWithBffError } from "@/server/bffGateway.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";

export async function POST(request: NextRequest) {
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  const { refreshToken } = readApiTokensFromCookies(request.cookies);
  if (refreshToken) await callAdsBackend({ method: "POST", path: "/auth/logout", body: encodeJsonRequestBody({ refreshToken }), contentType: "application/json" }).catch(() => null);
  const response = NextResponse.json({ redirectTo: "/login" }, { headers: { "Cache-Control": "no-store" } });
  clearEverySessionCookie(response);
  return response;
}
