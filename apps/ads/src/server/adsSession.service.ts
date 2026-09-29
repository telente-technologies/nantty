import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

import { buildHardenedCookieOptions, sessionCookieNames, sessionLifetimesInSeconds } from "@/config/sessionCookies.config";
import { signPayloadIntoCookieValue, verifySignedCookieValueAndReadPayload } from "@/server/signedCookie.service";
import type { AdAccountMembership, AdsUser } from "@/types/adAccount.type";

export interface CookieReader {
  get(name: string): { readonly value: string } | undefined;
}

export interface CachedSessionViewPayload {
  readonly sessionId: string;
  readonly user: AdsUser;
  readonly memberships: readonly AdAccountMembership[];
}

export interface ApiTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

const sessionViewPurpose = "ads-session-view";
const sessionIdPurpose = "ads-session-id";

export function createNewSessionId(): string {
  return randomBytes(24).toString("base64url");
}

export function readSessionIdFromCookies(cookies: CookieReader): string | null {
  return verifySignedCookieValueAndReadPayload<string>(cookies.get(sessionCookieNames.sessionId)?.value, sessionIdPurpose);
}

export function readCachedSessionViewFromCookies(cookies: CookieReader): CachedSessionViewPayload | null {
  const payload = verifySignedCookieValueAndReadPayload<CachedSessionViewPayload>(cookies.get(sessionCookieNames.sessionView)?.value, sessionViewPurpose);
  if (!payload || payload.sessionId !== readSessionIdFromCookies(cookies)) return null;
  return payload;
}

export function readApiTokensFromCookies(cookies: CookieReader): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: cookies.get(sessionCookieNames.accessToken)?.value ?? null,
    refreshToken: cookies.get(sessionCookieNames.refreshToken)?.value ?? null,
  };
}

export function writeSessionIdCookie(response: NextResponse, sessionId: string): void {
  const lifetime = sessionLifetimesInSeconds.session;
  response.cookies.set(sessionCookieNames.sessionId, signPayloadIntoCookieValue(sessionId, sessionIdPurpose, lifetime), buildHardenedCookieOptions(lifetime));
}

export function writeApiTokenCookies(response: NextResponse, tokens: ApiTokenPair): void {
  response.cookies.set(sessionCookieNames.accessToken, tokens.accessToken, buildHardenedCookieOptions(Math.min(tokens.expiresIn, sessionLifetimesInSeconds.accessToken)));
  response.cookies.set(sessionCookieNames.refreshToken, tokens.refreshToken, buildHardenedCookieOptions(sessionLifetimesInSeconds.refreshToken));
}

export function writeCachedSessionViewCookie(response: NextResponse, payload: CachedSessionViewPayload): void {
  const lifetime = sessionLifetimesInSeconds.sessionViewCache;
  response.cookies.set(sessionCookieNames.sessionView, signPayloadIntoCookieValue(payload, sessionViewPurpose, lifetime), buildHardenedCookieOptions(lifetime));
}

export function clearEverySessionCookie(response: NextResponse): void {
  for (const cookieName of [sessionCookieNames.accessToken, sessionCookieNames.refreshToken, sessionCookieNames.sessionId, sessionCookieNames.sessionView]) {
    response.cookies.set(cookieName, "", buildHardenedCookieOptions(0));
  }
}
