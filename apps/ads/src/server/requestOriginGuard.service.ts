import type { NextRequest } from "next/server";

import { readAdsManagerOrigin } from "@/config/adsEnvironment.config";
import { readSessionIdFromCookies } from "@/server/adsSession.service";
import { isCsrfTokenValidForSession } from "@/server/signedCookie.service";

export const csrfHeaderName = "x-csrf-token";

export function isRequestFromAdsManagerOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const originHeader = request.headers.get("origin");
  if (!originHeader) return false;
  return originHeader === readAdsManagerOrigin() || originHeader === request.nextUrl.origin;
}

export function isMutationProtectedAgainstCsrf(request: NextRequest): boolean {
  if (!isRequestFromAdsManagerOrigin(request)) return false;
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
