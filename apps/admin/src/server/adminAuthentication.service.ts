import { callAdminBackend, encodeJsonRequestBody, readJsonFromBackendResult } from "@/server/adminApiTransport.service";
import {
  createNewSessionId,
  nowInEpochSeconds,
  writeApiTokenCookies,
  writeCachedSessionViewCookie,
  writeSessionEnvelopeCookie,
  type ApiTokenPair,
  type CachedSessionView,
  type CookieWriter,
} from "@/server/adminSession.service";
import { isKnownAdminPermission } from "@/constants/adminPermissions.constant";
import type { SignedInAdmin } from "@/types/admin.type";

interface CurrentAdminResponse {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: SignedInAdmin["role"];
  readonly permissions: readonly string[];
}

export function convertCurrentAdminResponse(response: CurrentAdminResponse): SignedInAdmin {
  return { id: response.id, email: response.email, name: response.name, role: response.role, permissions: response.permissions.filter(isKnownAdminPermission) };
}

export function havePrivilegesChanged(previous: SignedInAdmin, current: SignedInAdmin): boolean {
  if (previous.id !== current.id || previous.role !== current.role) return true;
  const before = new Set(previous.permissions);
  return before.size !== new Set(current.permissions).size || current.permissions.some((permission) => !before.has(permission));
}

export async function exchangeRefreshTokenForNewTokenPair(refreshToken: string): Promise<ApiTokenPair | null> {
  const result = await callAdminBackend({ method: "POST", path: "/admin/auth/refresh", body: encodeJsonRequestBody({ refreshToken }), contentType: "application/json" });
  if (result.status !== 200) return null;
  const tokens = readJsonFromBackendResult<ApiTokenPair>(result);
  return tokens?.accessToken && tokens.refreshToken ? tokens : null;
}

async function fetchSignedInAdminWithAccessToken(accessToken: string): Promise<{ status: number; admin: SignedInAdmin | null }> {
  const result = await callAdminBackend({ method: "GET", path: "/admin/auth/me", accessToken });
  const body = result.status === 200 ? readJsonFromBackendResult<CurrentAdminResponse>(result) : null;
  return { status: result.status, admin: body ? convertCurrentAdminResponse(body) : null };
}

export interface RevalidatedAdminSession {
  readonly admin: SignedInAdmin;
  readonly rotatedTokens: ApiTokenPair | null;
}

export async function revalidateAdminWithBackend(tokens: { accessToken: string | null; refreshToken: string | null }): Promise<RevalidatedAdminSession | null> {
  let lookup = tokens.accessToken ? await fetchSignedInAdminWithAccessToken(tokens.accessToken) : { status: 401, admin: null };
  let rotatedTokens: ApiTokenPair | null = null;
  if (lookup.status === 401 && tokens.refreshToken) {
    rotatedTokens = await exchangeRefreshTokenForNewTokenPair(tokens.refreshToken);
    if (!rotatedTokens) return null;
    lookup = await fetchSignedInAdminWithAccessToken(rotatedTokens.accessToken);
  }
  return lookup.admin ? { admin: lookup.admin, rotatedTokens } : null;
}

export function writeFreshSessionViewCookie(cookies: CookieWriter, sessionId: string, admin: SignedInAdmin): CachedSessionView {
  const now = nowInEpochSeconds();
  const view: CachedSessionView = { sessionId, admin, lastActivityAtEpochSeconds: now, verifiedAtEpochSeconds: now };
  writeCachedSessionViewCookie(cookies, view);
  return view;
}

export function establishNewAdminSession(cookies: CookieWriter, tokens: ApiTokenPair, admin: SignedInAdmin): string {
  const sessionId = createNewSessionId();
  writeSessionEnvelopeCookie(cookies, { sessionId, startedAtEpochSeconds: nowInEpochSeconds() });
  writeApiTokenCookies(cookies, tokens);
  writeFreshSessionViewCookie(cookies, sessionId, admin);
  return sessionId;
}
