import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

import { buildHardenedCookieOptions, sessionCookieNames, sessionLifetimesInSeconds } from "@/config/sessionCookies.config";
import { signPayloadIntoCookieValue, verifySignedCookieValueAndReadPayload } from "@/server/signedCookie.service";
import type { SellerAccess, SignedInUser } from "@/types/sellerAccess.type";

export interface CookieReader {
  get(name: string): { readonly value: string } | undefined;
}

export interface CachedSellerAccessPayload {
  readonly sessionId: string;
  readonly user: SignedInUser;
  readonly access: SellerAccess;
}

export interface ApiTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

const accessCachePurpose = "seller-access";
const sessionIdPurpose = "session-id";
const selectedStorePurpose = "selected-store";

export function createNewSessionId(): string {
  return randomBytes(24).toString("base64url");
}

export function readSessionIdFromCookies(cookies: CookieReader): string | null {
  return verifySignedCookieValueAndReadPayload<string>(cookies.get(sessionCookieNames.sessionId)?.value, sessionIdPurpose);
}

export function readCachedSellerAccessFromCookies(cookies: CookieReader): CachedSellerAccessPayload | null {
  const payload = verifySignedCookieValueAndReadPayload<CachedSellerAccessPayload>(cookies.get(sessionCookieNames.sellerAccess)?.value, accessCachePurpose);
  if (!payload || payload.sessionId !== readSessionIdFromCookies(cookies)) return null;
  return payload;
}

export function readApiTokensFromCookies(cookies: CookieReader): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: cookies.get(sessionCookieNames.accessToken)?.value ?? null,
    refreshToken: cookies.get(sessionCookieNames.refreshToken)?.value ?? null,
  };
}

export function readSelectedLocationIdFromCookies(cookies: CookieReader): string | null {
  const rawValue = cookies.get(sessionCookieNames.selectedLocation)?.value ?? null;
  return rawValue && /^[A-Za-z0-9_-]{1,64}$/.test(rawValue) ? rawValue : null;
}

export function writeSessionIdCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(sessionCookieNames.sessionId, signPayloadIntoCookieValue(sessionId, sessionIdPurpose, sessionLifetimesInSeconds.session), buildHardenedCookieOptions(sessionLifetimesInSeconds.session));
}

export function writeApiTokenCookies(response: NextResponse, tokens: ApiTokenPair): void {
  response.cookies.set(sessionCookieNames.accessToken, tokens.accessToken, buildHardenedCookieOptions(Math.min(tokens.expiresIn, sessionLifetimesInSeconds.accessToken)));
  response.cookies.set(sessionCookieNames.refreshToken, tokens.refreshToken, buildHardenedCookieOptions(sessionLifetimesInSeconds.refreshToken));
}

export function writeCachedSellerAccessCookie(response: NextResponse, payload: CachedSellerAccessPayload): void {
  const lifetime = sessionLifetimesInSeconds.sellerAccessCache;
  response.cookies.set(sessionCookieNames.sellerAccess, signPayloadIntoCookieValue(payload, accessCachePurpose, lifetime), buildHardenedCookieOptions(lifetime));
}

export function readSelectedStoreIdFromCookies(cookies: CookieReader): string | null {
  const payload = verifySignedCookieValueAndReadPayload<{ readonly sessionId: string; readonly storeId: string }>(cookies.get(sessionCookieNames.selectedStore)?.value, selectedStorePurpose);
  return payload && payload.sessionId === readSessionIdFromCookies(cookies) ? payload.storeId : null;
}

export function writeSelectedStoreCookie(response: NextResponse, sessionId: string, storeId: string): void {
  const lifetime = sessionLifetimesInSeconds.session;
  response.cookies.set(sessionCookieNames.selectedStore, signPayloadIntoCookieValue({ sessionId, storeId }, selectedStorePurpose, lifetime), buildHardenedCookieOptions(lifetime));
}

export function clearStoreScopedCookies(response: NextResponse): void {
  for (const cookieName of [sessionCookieNames.sellerAccess, sessionCookieNames.selectedLocation]) {
    response.cookies.set(cookieName, "", buildHardenedCookieOptions(0));
  }
}

export function writeSelectedLocationCookie(response: NextResponse, locationId: string): void {
  response.cookies.set(sessionCookieNames.selectedLocation, locationId, buildHardenedCookieOptions(sessionLifetimesInSeconds.session));
}

export function clearEverySessionCookie(response: NextResponse): void {
  for (const cookieName of [sessionCookieNames.accessToken, sessionCookieNames.refreshToken, sessionCookieNames.sessionId, sessionCookieNames.sellerAccess, sessionCookieNames.selectedStore, sessionCookieNames.realtimeTicket]) {
    response.cookies.set(cookieName, "", buildHardenedCookieOptions(0));
  }
}
