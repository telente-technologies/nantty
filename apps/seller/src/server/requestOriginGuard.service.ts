import type { NextRequest } from "next/server";

import { readDashboardOrigin } from "@/config/sellerEnvironment.config";
import { readSessionIdFromCookies } from "@/server/sellerSession.service";
import { isCsrfTokenValidForSession } from "@/server/signedCookie.service";

export const csrfHeaderName = "x-csrf-token";

export function isRequestFromDashboardOrigin(request: NextRequest): boolean {
  const originHeader = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (!originHeader) return false;
  return originHeader === readDashboardOrigin() || originHeader === request.nextUrl.origin;
}

export function isMutationProtectedAgainstCsrf(request: NextRequest): boolean {
  if (!isRequestFromDashboardOrigin(request)) return false;
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
