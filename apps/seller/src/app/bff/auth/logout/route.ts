import { NextResponse, type NextRequest } from "next/server";

import { respondWithBffError } from "@/server/bffGateway.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";
import { callSellerBackend, encodeJsonRequestBody } from "@/server/sellerApiTransport.service";
import { clearEverySessionCookie, readApiTokensFromCookies } from "@/server/sellerSession.service";

export async function POST(request: NextRequest) {
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const { refreshToken, accessToken } = readApiTokensFromCookies(request.cookies);
  if (refreshToken) {
    await callSellerBackend({ method: "POST", path: "/auth/logout", body: encodeJsonRequestBody({ refreshToken }), contentType: "application/json", accessToken });
  }
  const response = new NextResponse(null, { status: 204 });
  clearEverySessionCookie(response);
  return response;
}
