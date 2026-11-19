import { NextResponse, type NextRequest } from "next/server";

import { shouldUseRealBackend } from "@/config/webappEnvironment.config";
import { renewViewerSession, writeRenewedSessionCookies } from "@/server/authentication.service";
import { callWebappBackend } from "@/server/apiTransport.service";
import { readVerifiedDeveloperSsoRedirect } from "@/server/developerSsoHandoff.service";
import { readApiTokensFromCookies, readSessionIdFromCookies } from "@/server/session.service";

const authorizePath = "/api/v1/auth/sso/authorize";

export async function GET(request: NextRequest) {
  if (!shouldUseRealBackend(authorizePath)) {
    return NextResponse.json({ code: "SSO_NOT_CONFIGURED" }, { status: 503 });
  }
  const sessionId = readSessionIdFromCookies(request.cookies);
  if (!sessionId) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`, request.nextUrl.origin), 303);
  const tokens = readApiTokensFromCookies(request.cookies);
  const renewed = await renewViewerSession({ sessionId, ...tokens });
  if (!renewed) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`, request.nextUrl.origin), 303);
  const result = await callWebappBackend({
    method: "GET",
    path: authorizePath,
    query: request.nextUrl.searchParams,
    accessToken: renewed.tokens?.accessToken ?? tokens.accessToken,
    forwardedHeaders: { Accept: "text/html" },
  });
  const target = result.status === 302
    ? readVerifiedDeveloperSsoRedirect(result.headers.get("location"), request.nextUrl.searchParams.get("redirect_uri"), request.nextUrl.searchParams.get("state"))
    : null;
  if (!target) return NextResponse.json({ code: "SSO_HANDOFF_FAILED" }, { status: result.status >= 400 ? result.status : 502 });
  const response = NextResponse.redirect(target, 302);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  writeRenewedSessionCookies(response, renewed);
  return response;
}
