import { NextResponse, type NextRequest } from "next/server";

import { doesAccessGrantPermission, findPermissionRequiredForApiCall, grantsChatMediaAccess } from "@/config/rolePermissions.config";
import { isMutationProtectedAgainstCsrf, isSafeHttpMethod } from "@/server/requestOriginGuard.service";
import { isAccessTokenKnownExpired } from "@/server/accessTokenExpiry.service";
import { exchangeRefreshTokenForNewTokenPair, renewSellerAccessCache, writeRenewedSessionCookies, type RenewedSellerSession } from "@/server/sellerAuthentication.service";
import { callSellerBackend, type BackendResult } from "@/server/sellerApiTransport.service";
import {
  clearEverySessionCookie,
  readApiTokensFromCookies,
  readCachedSellerAccessFromCookies,
  readSelectedLocationIdFromCookies,
  readSelectedStoreIdFromCookies,
  readSessionIdFromCookies,
  writeApiTokenCookies,
  type ApiTokenPair,
} from "@/server/sellerSession.service";
import { decideSellerAccessDestination } from "@/utils/sellerAccessDestination.util";

const maximumForwardedBodyBytes = 12 * 1024 * 1024;
const forwardedRequestHeaderNames = ["idempotency-key", "x-chunk-sha256", "if-match", "x-step-up-token"];
const longForwardedHeaderNames = new Set(["x-step-up-token"]);
const returnedResponseHeaderNames = ["content-type", "content-disposition", "idempotent-replayed", "retry-after", "etag", "x-request-id"];
export const allowedApiPathPattern = /^\/(seller|media|chat\/keys)(\/[A-Za-z0-9._~:@%-]+)+$|^\/chat\/content$|^\/payments\/(payout-onboarding\/me(\/[A-Za-z0-9._~:@%-]+)*|payout-fees|wallet\/me|verification\/me)$|^\/wallets\/me$/;
const readOnlyAccountApiPaths: ReadonlySet<string> = new Set(["/account/status", "/subscriptions/gold-for-businesses"]);
const accountWriteApiCalls: ReadonlySet<string> = new Set(["PATCH /users/me/preferences", "PUT /users/me/consents", "POST /auth/step-up", "POST /auth/otp/send", "POST /auth/otp/verify"]);
const brandSellingApiPattern = /^\/brands\/[A-Za-z0-9-]+$/;
const gateApiPathPattern = /^\/seller\/(access|verification|subscription|stores\/mine)(\/|$)/;

export function respondWithBffError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ message, code }, { status, headers: { "Cache-Control": "no-store", "x-request-id": crypto.randomUUID() } });
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

export async function forwardBffRequestToSellerApi(request: NextRequest, pathSegments: readonly string[]): Promise<NextResponse> {
  const apiPath = `/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  const isReadOnlyAccountPath = (readOnlyAccountApiPaths.has(apiPath) && request.method === "GET") || accountWriteApiCalls.has(`${request.method} ${apiPath}`) || (request.method === "PATCH" && brandSellingApiPattern.test(apiPath));
  if ((!allowedApiPathPattern.test(apiPath) && !isReadOnlyAccountPath) || apiPath.includes("..")) {
    return respondWithBffError(404, "NOT_FOUND", "This endpoint is not available.");
  }
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
  let renewedSession: RenewedSellerSession | null = null;
  let cachedAccess = readCachedSellerAccessFromCookies(request.cookies);
  if (!cachedAccess) {
    renewedSession = await renewSellerAccessCache({ sessionId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, knownUser: null, storeId: readSelectedStoreIdFromCookies(request.cookies) });
    if (!renewedSession) return respondSessionExpired();
    cachedAccess = renewedSession.cachedAccess;
  }

  const requiredPermission = findPermissionRequiredForApiCall(request.method, apiPath);
  if (requiredPermission === null) return respondWithBffError(403, "FORBIDDEN", "You do not have access to this.");
  const isAvailableBeforeStoreIsActive = gateApiPathPattern.test(apiPath) || isReadOnlyAccountPath;
  if (!isAvailableBeforeStoreIsActive && decideSellerAccessDestination(cachedAccess.access) !== "app") {
    return respondWithBffError(403, "STORE_NOT_ACTIVE", "This store is restricted. Check the note from Nantty.");
  }
  if (requiredPermission !== "signed_in" && !doesAccessGrantPermission(cachedAccess.access, requiredPermission) && !grantsChatMediaAccess(cachedAccess.access, apiPath)) {
    return respondWithBffError(403, "FORBIDDEN", "Your role does not allow this. Ask a manager or the store owner.");
  }

  const body = await readRequestBodyWithinLimit(request);
  if (body === "too_large") return respondWithBffError(413, "PAYLOAD_TOO_LARGE", "That upload is too large.");
  const forwardedHeaders: Record<string, string> = {};
  for (const headerName of forwardedRequestHeaderNames) {
    const headerValue = request.headers.get(headerName);
    if (headerValue && headerValue.length <= (longForwardedHeaderNames.has(headerName) ? 4096 : 256)) forwardedHeaders[headerName] = headerValue;
  }
  const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (clientAddress) forwardedHeaders["X-Forwarded-For"] = clientAddress;

  let accessToken = renewedSession?.tokens?.accessToken ?? tokens.accessToken;
  const sendToBackend = () =>
    callSellerBackend({
      method: request.method,
      path: apiPath,
      query: request.nextUrl.searchParams,
      body,
      contentType: request.headers.get("content-type"),
      accessToken,
      locationId: readSelectedLocationIdFromCookies(request.cookies),
      storeId: readSelectedStoreIdFromCookies(request.cookies),
      forwardedHeaders,
    });

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
