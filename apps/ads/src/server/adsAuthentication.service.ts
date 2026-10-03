import type { NextResponse } from "next/server";

import { callAdsBackend, encodeJsonRequestBody, readJsonFromBackendResult } from "@/server/adsApiTransport.service";
import { writeApiTokenCookies, writeCachedSessionViewCookie, type ApiTokenPair, type CachedSessionViewPayload } from "@/server/adsSession.service";
import type { AdAccountMembership, AdsUser } from "@/types/adAccount.type";

interface CurrentUserResponse {
  readonly id: string;
  readonly name: string | null;
  readonly username: string | null;
  readonly email: string | null;
  readonly avatarUrl: string | null;
}

export function convertCurrentUserToAdsUser(user: CurrentUserResponse): AdsUser {
  return { id: user.id, name: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl };
}

export async function exchangeRefreshTokenForNewTokenPair(refreshToken: string): Promise<ApiTokenPair | null> {
  const result = await callAdsBackend({ method: "POST", path: "/auth/refresh", body: encodeJsonRequestBody({ refreshToken }), contentType: "application/json" });
  if (result.status !== 200) return null;
  const tokens = readJsonFromBackendResult<ApiTokenPair>(result);
  return tokens?.accessToken && tokens.refreshToken ? tokens : null;
}

async function fetchMembershipsWithAccessToken(accessToken: string): Promise<{ status: number; memberships: AdAccountMembership[] | null }> {
  const result = await callAdsBackend({ method: "GET", path: "/ads/memberships", accessToken });
  const body = result.status === 200 ? readJsonFromBackendResult<{ items?: AdAccountMembership[]; data?: AdAccountMembership[] }>(result) : null;
  const memberships = body?.items ?? body?.data ?? null;
  return { status: result.status, memberships: memberships ? memberships.filter((membership) => /^[A-Za-z0-9_-]{1,64}$/.test(membership.accountId)) : null };
}

async function fetchSignedInUserWithAccessToken(accessToken: string): Promise<AdsUser | null> {
  const result = await callAdsBackend({ method: "GET", path: "/users/me", accessToken });
  const user = result.status === 200 ? readJsonFromBackendResult<CurrentUserResponse>(result) : null;
  return user ? convertCurrentUserToAdsUser(user) : null;
}

export interface RenewedAdsSession {
  readonly tokens: ApiTokenPair | null;
  readonly cachedView: CachedSessionViewPayload;
}

export async function renewCachedSessionView(options: {
  readonly sessionId: string;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly knownUser: AdsUser | null;
}): Promise<RenewedAdsSession | null> {
  let accessToken = options.accessToken;
  let renewedTokens: ApiTokenPair | null = null;
  let membershipLookup = accessToken ? await fetchMembershipsWithAccessToken(accessToken) : { status: 401, memberships: null };
  if (membershipLookup.status === 401 && options.refreshToken) {
    renewedTokens = await exchangeRefreshTokenForNewTokenPair(options.refreshToken);
    if (!renewedTokens) return null;
    accessToken = renewedTokens.accessToken;
    membershipLookup = await fetchMembershipsWithAccessToken(accessToken);
  }
  if (!membershipLookup.memberships || !accessToken) return null;
  const user = options.knownUser ?? (await fetchSignedInUserWithAccessToken(accessToken));
  if (!user) return null;
  return { tokens: renewedTokens, cachedView: { sessionId: options.sessionId, user, memberships: membershipLookup.memberships } };
}

export function writeRenewedSessionCookies(response: NextResponse, renewed: RenewedAdsSession): void {
  if (renewed.tokens) writeApiTokenCookies(response, renewed.tokens);
  writeCachedSessionViewCookie(response, renewed.cachedView);
}
