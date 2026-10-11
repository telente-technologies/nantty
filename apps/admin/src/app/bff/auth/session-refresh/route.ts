import { NextResponse, type NextRequest } from "next/server";

import { havePrivilegesChanged, revalidateAdminWithBackend } from "@/server/adminAuthentication.service";
import { nowInEpochSeconds, readApiTokensFromCookies, readCachedSessionViewFromCookies, writeApiTokenCookies, writeCachedSessionViewCookie } from "@/server/adminSession.service";
import { readSafeRelativeRedirectPath } from "@/server/requestOriginGuard.service";

export async function GET(request: NextRequest) {
  const nextPath = readSafeRelativeRedirectPath(request.nextUrl.searchParams.get("next"), "/");
  const view = readCachedSessionViewFromCookies(request.cookies);
  const revalidated = view ? await revalidateAdminWithBackend(readApiTokensFromCookies(request.cookies)) : null;
  const privilegesChanged = Boolean(view && revalidated && havePrivilegesChanged(view.admin, revalidated.admin));
  if (!view || !revalidated || privilegesChanged) {
    const signedOutUrl = new URL("/bff/auth/signed-out", request.nextUrl.origin);
    signedOutUrl.searchParams.set("reason", privilegesChanged ? "privileges" : view ? "expired" : "idle");
    signedOutUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(signedOutUrl, 303);
  }
  const response = NextResponse.redirect(new URL(nextPath, request.nextUrl.origin), 303);
  const now = nowInEpochSeconds();
  writeCachedSessionViewCookie(response.cookies, { ...view, admin: revalidated.admin, lastActivityAtEpochSeconds: now, verifiedAtEpochSeconds: now });
  if (revalidated.rotatedTokens) writeApiTokenCookies(response.cookies, revalidated.rotatedTokens);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
