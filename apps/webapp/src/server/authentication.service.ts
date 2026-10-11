import type { NextResponse } from "next/server";

import { callWebappBackend, encodeJsonRequestBody, readJsonFromBackendResult, type BackendResult } from "@/server/apiTransport.service";
import { clearEverySessionCookie, createNewSessionId, writeApiTokenCookies, writeCachedViewerCookie, writeSessionIdCookie, type ApiTokenPair } from "@/server/session.service";
import type { ApiErrorBody } from "@/types/apiError.type";
import type { AuthSession, User } from "@/types";

export interface AuthEndpointResult {
  readonly status: number;
  readonly session: AuthSession | null;
  readonly error: ApiErrorBody | null;
}

export async function callAuthEndpoint(path: string, body: unknown): Promise<AuthEndpointResult> {
  const result = await callWebappBackend({ method: "POST", path, body: encodeJsonRequestBody(body), contentType: "application/json" });
  return readAuthEndpointResult(result);
}

export function readAuthEndpointResult(result: BackendResult): AuthEndpointResult {
  const payload = readJsonFromBackendResult<AuthSession & ApiErrorBody>(result);
  const isError = result.status < 200 || result.status >= 300;
  return {
    status: result.status,
    session: !isError && payload ? payload : null,
    error: isError ? { message: payload?.message ?? "We couldn't sign you in just now. Try again in a moment.", code: payload?.code } : null,
  };
}

export function beginSessionWithAuthResult(response: NextResponse, session: AuthSession, sessionId: string = createNewSessionId()): string {
  writeSessionIdCookie(response, sessionId);
  writeApiTokenCookies(response, session);
  writeCachedViewerCookie(response, sessionId, session.user);
  return sessionId;
}


export async function exchangeRefreshTokenForNewTokenPair(refreshToken: string): Promise<ApiTokenPair | null> {
  const result = await callWebappBackend({ method: "POST", path: "/api/v1/auth/refresh", body: encodeJsonRequestBody({ refreshToken }), contentType: "application/json" });
  if (result.status !== 200) return null;
  const tokens = readJsonFromBackendResult<ApiTokenPair>(result);
  return tokens?.accessToken && tokens.refreshToken ? tokens : null;
}

export async function fetchViewerWithAccessToken(accessToken: string): Promise<User | null> {
  const result = await callWebappBackend({ method: "GET", path: "/api/v1/users/me", accessToken });
  return result.status === 200 ? readJsonFromBackendResult<User>(result) : null;
}

export interface RenewedViewerSession {
  readonly tokens: ApiTokenPair | null;
  readonly sessionId: string;
  readonly user: User;
}

export async function renewViewerSession(options: {
  readonly sessionId: string;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
}): Promise<RenewedViewerSession | null> {
  let accessToken = options.accessToken;
  let renewedTokens: ApiTokenPair | null = null;
  let viewer = accessToken ? await fetchViewerWithAccessToken(accessToken) : null;
  if (!viewer && options.refreshToken) {
    renewedTokens = await exchangeRefreshTokenForNewTokenPair(options.refreshToken);
    if (!renewedTokens) return null;
    accessToken = renewedTokens.accessToken;
    viewer = await fetchViewerWithAccessToken(accessToken);
  }
  if (!viewer) return null;
  return { tokens: renewedTokens, sessionId: options.sessionId, user: viewer };
}

export function writeRenewedSessionCookies(response: NextResponse, renewed: RenewedViewerSession): void {
  if (renewed.tokens) writeApiTokenCookies(response, renewed.tokens);
  writeCachedViewerCookie(response, renewed.sessionId, renewed.user);
}

export function endSessionOnResponse(response: NextResponse): NextResponse {
  clearEverySessionCookie(response);
  return response;
}
