import { NextResponse, type NextRequest } from "next/server";

import { exchangeRefreshTokenForNewTokenPair } from "@/server/adsAuthentication.service";
import { callAdsBackend, encodeJsonRequestBody } from "@/server/adsApiTransport.service";
import { clearEverySessionCookie, readApiTokensFromCookies } from "@/server/adsSession.service";
import { respondWithBffError } from "@/server/bffGateway.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";

async function revokeRefreshToken(accessToken: string | null, refreshToken: string): Promise<void> {
  const sendLogout = (token: string | null, refresh: string) => callAdsBackend({ method: "POST", path: "/auth/logout", body: encodeJsonRequestBody({ refreshToken: refresh }), contentType: "application/json", accessToken: token });
  const result = await sendLogout(accessToken, refreshToken);
  if (result.status !== 401) return;
  const rotated = await exchangeRefreshTokenForNewTokenPair(refreshToken);
  if (rotated) await sendLogout(rotated.accessToken, rotated.refreshToken);
}

export async function POST(request: NextRequest) {
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  const { accessToken, refreshToken } = readApiTokensFromCookies(request.cookies);
  if (refreshToken) await revokeRefreshToken(accessToken, refreshToken).catch(() => undefined);
  const response = NextResponse.json({ redirectTo: "/login" }, { headers: { "Cache-Control": "no-store" } });
  clearEverySessionCookie(response);
  return response;
}
