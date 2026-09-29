import type { NextResponse } from "next/server";

import { callSellerBackend, encodeJsonRequestBody, readJsonFromBackendResult } from "@/server/sellerApiTransport.service";
import { writeApiTokenCookies, writeCachedSellerAccessCookie, type ApiTokenPair, type CachedSellerAccessPayload } from "@/server/sellerSession.service";
import type { SellerAccess, SignedInUser } from "@/types/sellerAccess.type";

interface CurrentUserResponse {
  readonly id: string;
  readonly name: string | null;
  readonly username: string | null;
  readonly email: string | null;
  readonly avatarUrl: string | null;
}

export function convertCurrentUserToSignedInUser(user: CurrentUserResponse): SignedInUser {
  return { id: user.id, name: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl };
}

export async function exchangeRefreshTokenForNewTokenPair(refreshToken: string): Promise<ApiTokenPair | null> {
  const result = await callSellerBackend({ method: "POST", path: "/auth/refresh", body: encodeJsonRequestBody({ refreshToken }), contentType: "application/json" });
  if (result.status !== 200) return null;
  const tokens = readJsonFromBackendResult<ApiTokenPair>(result);
  return tokens?.accessToken && tokens.refreshToken ? tokens : null;
}

export async function fetchSellerAccessWithAccessToken(accessToken: string, storeId: string | null = null): Promise<{ status: number; access: SellerAccess | null }> {
  const result = await callSellerBackend({ method: "GET", path: "/seller/access", accessToken, storeId });
  return { status: result.status, access: result.status === 200 ? readJsonFromBackendResult<SellerAccess>(result) : null };
}

export async function fetchSignedInUserWithAccessToken(accessToken: string): Promise<SignedInUser | null> {
  const result = await callSellerBackend({ method: "GET", path: "/users/me", accessToken });
  const user = result.status === 200 ? readJsonFromBackendResult<CurrentUserResponse>(result) : null;
  return user ? convertCurrentUserToSignedInUser(user) : null;
}

export interface RenewedSellerSession {
  readonly tokens: ApiTokenPair | null;
  readonly cachedAccess: CachedSellerAccessPayload;
}

export async function renewSellerAccessCache(options: {
  readonly sessionId: string;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly knownUser: SignedInUser | null;
  readonly storeId?: string | null;
}): Promise<RenewedSellerSession | null> {
  let accessToken = options.accessToken;
  let renewedTokens: ApiTokenPair | null = null;
  let accessLookup = accessToken ? await fetchSellerAccessWithAccessToken(accessToken, options.storeId ?? null) : { status: 401, access: null };
  if (accessLookup.status === 401 && options.refreshToken) {
    renewedTokens = await exchangeRefreshTokenForNewTokenPair(options.refreshToken);
    if (!renewedTokens) return null;
    accessToken = renewedTokens.accessToken;
    accessLookup = await fetchSellerAccessWithAccessToken(accessToken, options.storeId ?? null);
  }
  if (!accessLookup.access || !accessToken) return null;
  const user = options.knownUser ?? (await fetchSignedInUserWithAccessToken(accessToken));
  if (!user) return null;
  return { tokens: renewedTokens, cachedAccess: { sessionId: options.sessionId, user, access: accessLookup.access } };
}

export function writeRenewedSessionCookies(response: NextResponse, renewed: RenewedSellerSession): void {
  if (renewed.tokens) writeApiTokenCookies(response, renewed.tokens);
  writeCachedSellerAccessCookie(response, renewed.cachedAccess);
}
