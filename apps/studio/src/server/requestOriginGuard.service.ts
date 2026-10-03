import type { NextRequest } from "next/server";

import { readStudioOrigin } from "@/config/studioEnvironment.config";
import { readSessionIdFromCookies } from "@/server/session.service";
import { isCsrfTokenValidForSession } from "@/server/signedCookie.service";
import { readSafeRelativeRedirectPath } from "@/utils/safeRedirectPath.util";

export const csrfHeaderName = "x-csrf-token";

export function isRequestFromStudioOrigin(request: NextRequest): boolean {
  const originHeader = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (!originHeader) return false;
  return originHeader === readStudioOrigin() || originHeader === request.nextUrl.origin;
}

export function isMutationProtectedAgainstCsrf(request: NextRequest): boolean {
  if (!isRequestFromStudioOrigin(request)) return false;
  const sessionId = readSessionIdFromCookies(request.cookies) ?? undefined;
  return isCsrfTokenValidForSession(sessionId, request.headers.get(csrfHeaderName));
}

export function isSafeHttpMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

export { readSafeRelativeRedirectPath };
