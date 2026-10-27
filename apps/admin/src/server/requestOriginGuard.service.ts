import type { NextRequest } from "next/server";

import { readAdminConsoleOrigin } from "@/config/adminEnvironment.config";
import { readSessionEnvelopeFromCookies } from "@/server/adminSession.service";
import { isCsrfTokenValidForSession } from "@/server/signedCookie.service";

export const csrfHeaderName = "x-csrf-token";

export function isRequestFromAdminConsoleOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const originHeader = request.headers.get("origin");
  if (!originHeader) return false;
  return originHeader === readAdminConsoleOrigin() || originHeader === request.nextUrl.origin;
}

export function isMutationProtectedAgainstCsrf(request: NextRequest): boolean {
  if (!isRequestFromAdminConsoleOrigin(request)) return false;
  const sessionId = readSessionEnvelopeFromCookies(request.cookies)?.sessionId;
  return isCsrfTokenValidForSession(sessionId, request.headers.get(csrfHeaderName));
}

export function isSafeHttpMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

export function readSafeRelativeRedirectPath(candidate: string | null | undefined, fallbackPath: string): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\") || candidate.startsWith("/bff") || candidate.length > 512) return fallbackPath;
  return candidate;
}

export function readClientIpAddress(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
}

export function readClientUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent")?.slice(0, 200) ?? "nantty-admin";
}
