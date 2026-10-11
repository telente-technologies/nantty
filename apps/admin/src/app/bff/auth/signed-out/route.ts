import { NextResponse, type NextRequest } from "next/server";

import { sendJsonToAdminBackend } from "@/server/adminApiTransport.service";
import { clearEverySessionCookie, readApiTokensFromCookies } from "@/server/adminSession.service";
import { readSafeRelativeRedirectPath } from "@/server/requestOriginGuard.service";

const knownReasons = new Set(["idle", "expired", "signed-out", "privileges"]);

export async function GET(request: NextRequest) {
  const tokens = readApiTokensFromCookies(request.cookies);
  if (tokens.refreshToken) await sendJsonToAdminBackend("POST", "/admin/auth/logout", { refreshToken: tokens.refreshToken }, { accessToken: tokens.accessToken });
  const reason = request.nextUrl.searchParams.get("reason") ?? "";
  const target = new URL("/login", request.nextUrl.origin);
  target.searchParams.set("reason", knownReasons.has(reason) ? reason : "expired");
  const nextPath = readSafeRelativeRedirectPath(request.nextUrl.searchParams.get("next"), "");
  if (nextPath) target.searchParams.set("next", nextPath);
  const response = NextResponse.redirect(target, 303);
  clearEverySessionCookie(response.cookies);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
