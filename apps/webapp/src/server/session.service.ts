import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

import { buildHardenedCookieOptions, sessionCookieNames, sessionLifetimesInSeconds } from "@/config/sessionCookies.config";
import { signPayloadIntoCookieValue, verifySignedCookieValueAndReadPayload } from "@/server/signedCookie.service";
import type { User } from "@/types";

export interface CookieReader {
  get(name: string): { readonly value: string } | undefined;
}

export interface ApiTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn?: number;
}

const viewerPurpose = "viewer";
const sessionIdPurpose = "session-id";

export function createNewSessionId(): string {
  return randomBytes(24).toString("base64url");
}

export function readSessionIdFromCookies(cookies: CookieReader): string | null {
  return verifySignedCookieValueAndReadPayload<string>(cookies.get(sessionCookieNames.sessionId)?.value, sessionIdPurpose);
}

export function readCachedViewerFromCookies(cookies: CookieReader): User | null {
  const payload = verifySignedCookieValueAndReadPayload<{ readonly sessionId: string; readonly user: User }>(
    cookies.get(sessionCookieNames.viewer)?.value,
    viewerPurpose,
  );
  if (!payload || payload.sessionId !== readSessionIdFromCookies(cookies)) return null;
  return payload.user;
}

export function readApiTokensFromCookies(cookies: CookieReader): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: cookies.get(sessionCookieNames.accessToken)?.value ?? null,
    refreshToken: cookies.get(sessionCookieNames.refreshToken)?.value ?? null,
  };
}

export function writeSessionIdCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(sessionCookieNames.sessionId, signPayloadIntoCookieValue(sessionId, sessionIdPurpose, sessionLifetimesInSeconds.session), buildHardenedCookieOptions(sessionLifetimesInSeconds.session));
}

export function writeApiTokenCookies(response: NextResponse, tokens: ApiTokenPair): void {
  response.cookies.set(sessionCookieNames.accessToken, tokens.accessToken, buildHardenedCookieOptions(tokens.expiresIn ?? sessionLifetimesInSeconds.accessToken));
  response.cookies.set(sessionCookieNames.refreshToken, tokens.refreshToken, buildHardenedCookieOptions(sessionLifetimesInSeconds.refreshToken));
}

export function writeCachedViewerCookie(response: NextResponse, sessionId: string, user: User): void {
  const lifetime = sessionLifetimesInSeconds.viewerCache;
  const value = signPayloadIntoCookieValue({ sessionId, user }, viewerPurpose, lifetime);
  response.cookies.set(sessionCookieNames.viewer, value, buildHardenedCookieOptions(lifetime));
}

export function clearEverySessionCookie(response: NextResponse): void {
  for (const cookieName of [sessionCookieNames.accessToken, sessionCookieNames.refreshToken, sessionCookieNames.sessionId, sessionCookieNames.viewer, sessionCookieNames.realtimeTicket]) {
    response.cookies.set(cookieName, "", buildHardenedCookieOptions(0));
  }
}
