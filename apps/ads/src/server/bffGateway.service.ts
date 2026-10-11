import { NextResponse, type NextRequest } from "next/server";

import { doesRoleHavePermission, findRequirementForApiCall } from "@/config/rolePermissions.config";
import { isAccessTokenKnownExpired } from "@/server/accessTokenExpiry.service";
import { exchangeRefreshTokenForNewTokenPair, renewCachedSessionView, writeRenewedSessionCookies, type RenewedAdsSession } from "@/server/adsAuthentication.service";
import { callAdsBackend, type BackendResult } from "@/server/adsApiTransport.service";
import { clearEverySessionCookie, readApiTokensFromCookies, readCachedSessionViewFromCookies, readSessionIdFromCookies, writeApiTokenCookies, type ApiTokenPair, type CachedSessionViewPayload } from "@/server/adsSession.service";
import { isMutationProtectedAgainstCsrf, isSafeHttpMethod } from "@/server/requestOriginGuard.service";

const maximumForwardedBodyBytes = 12 * 1024 * 1024;
const forwardedRequestHeaderNames = ["idempotency-key", "if-match"];
const returnedResponseHeaderNames = ["content-type", "content-disposition", "idempotent-replayed", "retry-after", "etag"];
const allowedApiPathPattern = /^\/(ads|media|topics|users)(\/[A-Za-z0-9._~:@%-]+)*$|^\/wallets\/me$/;

export function respondWithBffError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ message, code }, { status, headers: { "Cache-Control": "no-store" } });
}

function convertBackendResultToResponse(result: BackendResult): NextResponse {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const headerName of returnedResponseHeaderNames) {
    const headerValue = result.headers.get(headerName);
    if (headerValue) headers.set(headerName, headerValue);
  }
  const hasBody = result.status !== 204 && result.status !== 304 && result.body.byteLength > 0;
  return new NextResponse(hasBody ? Buffer.from(result.body) : null, { status: result.status, headers });
}

async function readRequestBodyWithinLimit(request: NextRequest): Promise<Uint8Array | null | "too_large"> {
  if (isSafeHttpMethod(request.method)) return null;
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maximumForwardedBodyBytes) return "too_large";
  const body = new Uint8Array(await request.arrayBuffer());
  return body.byteLength > maximumForwardedBodyBytes ? "too_large" : body;
}

function findRoleForAccount(view: CachedSessionViewPayload, accountId: string) {
  return view.memberships.find((membership) => membership.accountId === accountId)?.role ?? null;
}

export async function forwardBffRequestToAdsApi(request: NextRequest, pathSegments: readonly string[]): Promise<NextResponse> {
  const apiPath = `/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  if (!allowedApiPathPattern.test(apiPath) || apiPath.includes("..")) return respondWithBffError(404, "NOT_FOUND", "This endpoint is not available.");
  const requirement = findRequirementForApiCall(request.method, apiPath);
  if (requirement.kind === "denied") return respondWithBffError(404, "NOT_FOUND", "This endpoint is not available.");

  const sessionId = readSessionIdFromCookies(request.cookies);
  if (!sessionId) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!isSafeHttpMethod(request.method) && !isMutationProtectedAgainstCsrf(request)) {
    return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  }

  const cookieTokens = readApiTokensFromCookies(request.cookies);
  const respondSessionExpired = () => {
    const expiredResponse = respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
    clearEverySessionCookie(expiredResponse);
    return expiredResponse;
  };
  let rotatedTokens: ApiTokenPair | null = null;
  if (isAccessTokenKnownExpired(cookieTokens.accessToken)) {
    rotatedTokens = cookieTokens.refreshToken ? await exchangeRefreshTokenForNewTokenPair(cookieTokens.refreshToken) : null;
    if (!rotatedTokens) return respondSessionExpired();
  }
  const tokens = rotatedTokens ?? cookieTokens;
  let renewedSession: RenewedAdsSession | null = null;
  let cachedView = readCachedSessionViewFromCookies(request.cookies);
  const needsFreshMemberships = requirement.kind === "account" && cachedView !== null && findRoleForAccount(cachedView, requirement.accountId) === null;
  if (!cachedView || needsFreshMemberships) {
    renewedSession = await renewCachedSessionView({ sessionId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, knownUser: cachedView?.user ?? null });
    if (!renewedSession) return respondSessionExpired();
    cachedView = renewedSession.cachedView;
  }

  if (requirement.kind === "account") {
    const role = findRoleForAccount(cachedView, requirement.accountId);
    if (!role) return respondWithBffError(404, "AD_ACCOUNT_NOT_FOUND", "This ad account does not exist or you are not a member.");
    if (!doesRoleHavePermission(role, requirement.permission)) return respondWithBffError(403, "FORBIDDEN", "Your role on this ad account does not allow this. Ask an admin.");
  }

  const body = await readRequestBodyWithinLimit(request);
  if (body === "too_large") return respondWithBffError(413, "PAYLOAD_TOO_LARGE", "That upload is too large.");
  const forwardedHeaders: Record<string, string> = {};
  for (const headerName of forwardedRequestHeaderNames) {
    const headerValue = request.headers.get(headerName);
    if (headerValue && headerValue.length <= 256) forwardedHeaders[headerName] = headerValue;
  }
  const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (clientAddress) forwardedHeaders["X-Forwarded-For"] = clientAddress;

  let accessToken = renewedSession?.tokens?.accessToken ?? tokens.accessToken;
  const sendToBackend = () =>
    callAdsBackend({ method: request.method, path: apiPath, query: request.nextUrl.searchParams, body, contentType: request.headers.get("content-type"), accessToken, forwardedHeaders });

  let backendResult = await sendToBackend();
  const alreadyRefreshed = rotatedTokens !== null || Boolean(renewedSession?.tokens);
  const refreshTokenToUse = renewedSession?.tokens?.refreshToken ?? tokens.refreshToken;
  if (backendResult.status === 401 && !alreadyRefreshed) {
    rotatedTokens = refreshTokenToUse ? await exchangeRefreshTokenForNewTokenPair(refreshTokenToUse) : null;
    if (!rotatedTokens) return respondSessionExpired();
    accessToken = rotatedTokens.accessToken;
    backendResult = await sendToBackend();
  }

  const response = convertBackendResultToResponse(backendResult);
  if (renewedSession) writeRenewedSessionCookies(response, renewedSession);
  if (rotatedTokens) writeApiTokenCookies(response, rotatedTokens);
  return response;
}
