import type { NextRequest } from "next/server";

import { sendJsonToAdminBackend } from "@/server/adminApiTransport.service";
import { clearEverySessionCookie, readApiTokensFromCookies } from "@/server/adminSession.service";
import { respondWithBffError, respondWithJson } from "@/server/bffResponses.service";
import { isMutationProtectedAgainstCsrf } from "@/server/requestOriginGuard.service";

export async function POST(request: NextRequest) {
  if (!isMutationProtectedAgainstCsrf(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  const tokens = readApiTokensFromCookies(request.cookies);
  if (tokens.refreshToken) await sendJsonToAdminBackend("POST", "/admin/auth/logout", { refreshToken: tokens.refreshToken }, { accessToken: tokens.accessToken });
  const response = respondWithJson({ redirectTo: "/login?reason=signed-out" });
  clearEverySessionCookie(response.cookies);
  return response;
}
