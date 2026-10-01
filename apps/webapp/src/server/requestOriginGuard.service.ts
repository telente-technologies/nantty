import type { NextRequest } from "next/server";

import { readWebappOrigin } from "@/config/webappEnvironment.config";
import { readSessionIdFromCookies } from "@/server/session.service";
import { isCsrfTokenValidForSession } from "@/server/signedCookie.service";

export const csrfHeaderName = "x-csrf-token";

export function isRequestFromWebappOrigin(request: NextRequest): boolean {
  const originHeader = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (!originHeader) return false;
  return originHeader === readWebappOrigin() || originHeader === request.nextUrl.origin;
}

export function isMutationProtectedAgainstCsrf(request: NextRequest): boolean {
  if (!isRequestFromWebappOrigin(request)) return false;
  const sessionId = readSessionIdFromCookies(request.cookies) ?? undefined;
  return isCsrfTokenValidForSession(sessionId, request.headers.get(csrfHeaderName));
}

export function isSafeHttpMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

export function readSafeRelativeRedirectPath(candidate: string | null, fallbackPath: string): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\") || candidate.startsWith("/bff")) return fallbackPath;
  return candidate;
}
