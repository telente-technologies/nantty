import { NextResponse, type NextRequest } from "next/server";

import { respondWithBffError } from "@/server/gateway.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";
import { callStudioBackend, encodeJsonRequestBody } from "@/server/apiTransport.service";
import { clearEverySessionCookie, readApiTokensFromCookies } from "@/server/session.service";

export async function POST(request: NextRequest) {
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const { refreshToken, accessToken } = readApiTokensFromCookies(request.cookies);
  if (refreshToken) {
    await callStudioBackend({ method: "POST", path: "/api/v1/auth/logout", body: encodeJsonRequestBody({ refreshToken }), contentType: "application/json", accessToken });
  }
  const response = new NextResponse(null, { status: 204 });
  clearEverySessionCookie(response);
  return response;
}
