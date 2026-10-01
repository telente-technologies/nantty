import { NextResponse, type NextRequest } from "next/server";

import { renewViewerSession, writeRenewedSessionCookies } from "@/server/authentication.service";
import { respondWithBffError } from "@/server/gateway.service";
import { readApiTokensFromCookies, readCachedViewerFromCookies, readSessionIdFromCookies } from "@/server/session.service";

export async function GET(request: NextRequest) {
  const sessionId = readSessionIdFromCookies(request.cookies);
  if (!sessionId) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const cachedViewer = readCachedViewerFromCookies(request.cookies);
  const tokens = readApiTokensFromCookies(request.cookies);
  if (cachedViewer && tokens.accessToken) return NextResponse.json({ user: cachedViewer }, { headers: { "Cache-Control": "no-store" } });

  const renewed = await renewViewerSession({ sessionId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  if (!renewed) return respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
  const response = NextResponse.json({ user: renewed.user }, { headers: { "Cache-Control": "no-store" } });
  writeRenewedSessionCookies(response, renewed);
  return response;
}
