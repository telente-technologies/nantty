import { NextResponse, type NextRequest } from "next/server";

import { exchangeRefreshTokenForNewTokenPair, renewViewerSession, writeRenewedSessionCookies } from "@/server/authentication.service";
import { callWebappBackend, type BackendResult } from "@/server/apiTransport.service";
import { isPublicApiRead } from "@/config/guestBrowsing.config";
import { resetViewerFieldsForAnonymousResult } from "@/server/anonymousViewerFields.service";
import { isMutationProtectedAgainstCsrf, isRequestFromWebappOrigin, isSafeHttpMethod } from "@/server/requestOriginGuard.service";
import { isAccessTokenKnownExpired } from "@/server/accessTokenExpiry.service";
import { clearEverySessionCookie, readApiTokensFromCookies, readCachedViewerFromCookies, readSessionIdFromCookies, writeApiTokenCookies } from "@/server/session.service";

const maximumForwardedBodyBytes = 8 * 1024 * 1024;
const forwardedRequestHeaderNames = ["idempotency-key", "x-client-region", "if-match", "x-step-up-token"];
const longForwardedHeaderNames = new Set(["x-step-up-token"]);
const returnedResponseHeaderNames = ["content-type", "content-disposition", "idempotent-replayed", "retry-after", "etag", "x-request-id"];
const allowedApiPathPattern = /^\/api\/v1(\/[A-Za-z0-9._~:@%,-]+)+$/;
// Ad-click redirects record a billable click on GET. Their signed links point
// directly at the public API host; never proxy them through a cookie session.
const stateChangingGetApiPathPattern = /^\/api\/v1\/ads\/r\/[^/]+$/;

const publicApiRoutes = [
  { method: "POST", path: "/api/v1/auth/otp/send" },
  { method: "POST", path: "/api/v1/auth/otp/verify" },
  { method: "POST", path: "/api/v1/auth/password/reset" },
  { method: "GET", path: "/api/v1/auth/username-available" },
  { method: "GET", path: "/api/v1/auth/username-suggestion" },
  { method: "GET", path: "/api/v1/topics" },
];

function isPublicApiRequest(method: string, apiPath: string): boolean {
  return publicApiRoutes.some((route) => route.method === method && route.path === apiPath);
}

export function respondWithBffError(status: number, code: string, message: string, suggestions?: readonly string[]): NextResponse {
  return NextResponse.json({ message, code, ...(suggestions ? { suggestions } : {}) }, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": crypto.randomUUID() } });
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

function isAllowedApiPath(apiPath: string): boolean {
  return !apiPath.includes("..") && allowedApiPathPattern.test(apiPath);
}

export async function forwardBffRequestToWebappApi(request: NextRequest, pathSegments: readonly string[]): Promise<NextResponse> {
  const apiPath = `/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  if (!isAllowedApiPath(apiPath)) return respondWithBffError(404, "NOT_FOUND", "This endpoint is not available.");
  if (request.method === "GET" && stateChangingGetApiPathPattern.test(apiPath)) {
    return respondWithBffError(404, "NOT_FOUND", "This endpoint is not available.");
  }

  const sessionId = readSessionIdFromCookies(request.cookies);
  const isAnonymousPublicRead = !sessionId && isPublicApiRead(request.method, apiPath);
  const isPublicRoute = isPublicApiRequest(request.method, apiPath) || isAnonymousPublicRead;
  if (!isPublicRoute && !sessionId) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!isSafeHttpMethod(request.method)) {
    const requestIsVerified = isPublicRoute ? isRequestFromWebappOrigin(request) : isMutationProtectedAgainstCsrf(request);
    if (!requestIsVerified) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  }

  const tokens = readApiTokensFromCookies(request.cookies);
  const cachedViewer = readCachedViewerFromCookies(request.cookies);
  const allowsAnonymous = isPublicApiRequest(request.method, apiPath) || isPublicApiRead(request.method, apiPath);
  let accessToken = tokens.accessToken;
  let renewedSession = null as Awaited<ReturnType<typeof renewViewerSession>>;
  let rotatedTokens: Awaited<ReturnType<typeof exchangeRefreshTokenForNewTokenPair>> = null;
  let refreshAttempted = false;
  let sessionLost = false;
  const rotateTokensOnce = async (): Promise<boolean> => {
    const refreshToken = renewedSession?.tokens?.refreshToken ?? tokens.refreshToken;
    if (refreshAttempted || !refreshToken) return false;
    refreshAttempted = true;
    rotatedTokens = await exchangeRefreshTokenForNewTokenPair(refreshToken);
    if (rotatedTokens) accessToken = rotatedTokens.accessToken;
    return rotatedTokens !== null;
  };
  const respondSessionExpired = () => {
    const expiredResponse = respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
    clearEverySessionCookie(expiredResponse);
    return expiredResponse;
  };

  if (isAccessTokenKnownExpired(accessToken) && !(await rotateTokensOnce())) {
    accessToken = null;
    sessionLost = true;
  }
  if (sessionLost && !allowsAnonymous) return respondSessionExpired();

  if (!isPublicRoute && !sessionLost && (!cachedViewer || !accessToken)) {
    renewedSession = await renewViewerSession({ sessionId: sessionId!, accessToken, refreshToken: rotatedTokens ? null : tokens.refreshToken });
    if (!renewedSession) {
      if (!allowsAnonymous) return respondSessionExpired();
      accessToken = null;
      sessionLost = true;
    } else {
      accessToken = renewedSession.tokens?.accessToken ?? accessToken;
    }
  }

  const body = await readRequestBodyWithinLimit(request);
  if (body === "too_large") return respondWithBffError(413, "PAYLOAD_TOO_LARGE", "That upload is too large.");

  const forwardedHeaders: Record<string, string> = {};
  for (const headerName of forwardedRequestHeaderNames) {
    if (headerName === "x-client-region" && !isSafeHttpMethod(request.method)) continue;
    const headerValue = request.headers.get(headerName);
    if (headerValue && headerValue.length <= (longForwardedHeaderNames.has(headerName) ? 4096 : 256)) forwardedHeaders[headerName] = headerValue;
  }

  const sendToBackend = () =>
    callWebappBackend({
      method: request.method,
      path: apiPath,
      query: request.nextUrl.searchParams,
      body,
      contentType: request.headers.get("content-type"),
      accessToken,
      forwardedHeaders,
    });

  let backendResult = await sendToBackend();
  if (backendResult.status === 401 && accessToken) {
    if (await rotateTokensOnce()) backendResult = await sendToBackend();
    else {
      sessionLost = true;
      if (allowsAnonymous) {
        accessToken = null;
        backendResult = await sendToBackend();
      }
    }
  }

  const answeredAnonymously = isAnonymousPublicRead || (sessionLost && accessToken === null);
  const response = convertBackendResultToResponse(answeredAnonymously ? resetViewerFieldsForAnonymousResult(backendResult) : backendResult);
  if (sessionLost) {
    clearEverySessionCookie(response);
    return response;
  }
  if (renewedSession) writeRenewedSessionCookies(response, renewedSession);
  if (rotatedTokens) writeApiTokenCookies(response, rotatedTokens);
  return response;
}
