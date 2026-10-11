import { NextResponse, type NextRequest } from "next/server";

import { shouldUseRealBackend } from "@/config/studioEnvironment.config";
import { findStudioApiRoute } from "@/config/studioApiAccess.config";

import { exchangeRefreshTokenForNewTokenPair, renewViewerSession, writeRenewedSessionCookies } from "@/server/authentication.service";
import { callStudioBackend, type BackendResult } from "@/server/apiTransport.service";
import { isMutationProtectedAgainstCsrf, isRequestFromStudioOrigin, isSafeHttpMethod } from "@/server/requestOriginGuard.service";
import { isAccessTokenKnownExpired } from "@/server/accessTokenExpiry.service";
import { clearEverySessionCookie, readApiTokensFromCookies, readCachedViewerFromCookies, readSessionIdFromCookies, writeApiTokenCookies } from "@/server/session.service";

const maximumForwardedBodyBytes = 8 * 1024 * 1024;
const forwardedRequestHeaderNames = ["idempotency-key", "x-client-region", "if-match", "x-step-up-token"];
const longForwardedHeaderNames = new Set(["x-step-up-token"]);
const returnedResponseHeaderNames = ["content-type", "content-disposition", "idempotent-replayed", "retry-after", "etag"];
const allowedApiPathPattern = /^\/api\/v1(\/[A-Za-z0-9._~:@%,-]+)+$/;

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

function isAllowedApiPath(apiPath: string): boolean {
  return !apiPath.includes("..") && allowedApiPathPattern.test(apiPath);
}

export async function forwardBffRequestToStudioApi(request: NextRequest, pathSegments: readonly string[]): Promise<NextResponse> {
  const apiPath = `/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  if (!isAllowedApiPath(apiPath)) return respondWithBffError(404, "NOT_FOUND", "This endpoint is not available.");
  const studioRoute = findStudioApiRoute(request.method, apiPath, !shouldUseRealBackend(apiPath));
  if (!studioRoute) return respondWithBffError(404, "NOT_AVAILABLE_IN_STUDIO", "Studio can't make this request.");

  const isPublicRoute = studioRoute.isPublic === true;
  const sessionId = readSessionIdFromCookies(request.cookies);
  if (!isPublicRoute && !sessionId) return respondWithBffError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!isSafeHttpMethod(request.method)) {
    const requestIsVerified = isPublicRoute ? isRequestFromStudioOrigin(request) : isMutationProtectedAgainstCsrf(request);
    if (!requestIsVerified) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  }

  const tokens = readApiTokensFromCookies(request.cookies);
  const cachedViewer = readCachedViewerFromCookies(request.cookies);
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
  if (sessionLost && !isPublicRoute) return respondSessionExpired();

  if (!isPublicRoute && (!cachedViewer || !accessToken)) {
    renewedSession = await renewViewerSession({ sessionId: sessionId!, accessToken, refreshToken: rotatedTokens ? null : tokens.refreshToken });
    if (!renewedSession) return respondSessionExpired();
    accessToken = renewedSession.tokens?.accessToken ?? accessToken;
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
    callStudioBackend({
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
    else if (!isPublicRoute) return respondSessionExpired();
    else {
      sessionLost = true;
      accessToken = null;
      backendResult = await sendToBackend();
    }
  }

  const response = convertBackendResultToResponse(backendResult);
  if (sessionLost) {
    clearEverySessionCookie(response);
    return response;
  }
  if (renewedSession) writeRenewedSessionCookies(response, renewedSession);
  if (rotatedTokens) writeApiTokenCookies(response, rotatedTokens);
  return response;
}
