import { NextResponse, type NextRequest } from "next/server";

import { findAdminApiRoute, isReasonMissing, minimumReasonLength, type ApiAccessRequirement, type ResolvedApiRoute } from "@/config/apiAccess.config";
import { exchangeRefreshTokenForNewTokenPair, havePrivilegesChanged, revalidateAdminWithBackend } from "@/server/adminAuthentication.service";
import { callAdminBackend, type BackendResult } from "@/server/adminApiTransport.service";
import {
  clearCookieByName,
  clearEverySessionCookie,
  isCachedSessionViewStale,
  nowInEpochSeconds,
  readApiTokensFromCookies,
  readCachedSessionViewFromCookies,
  readSessionEnvelopeFromCookies,
  readStepUpTokenForSession,
  writeApiTokenCookies,
  writeCachedSessionViewCookie,
  type ApiTokenPair,
  type CachedSessionView,
} from "@/server/adminSession.service";
import { respondWithBffError } from "@/server/bffResponses.service";
import { isMutationProtectedAgainstCsrf, isSafeHttpMethod, readClientIpAddress, readClientUserAgent } from "@/server/requestOriginGuard.service";
import type { SignedInAdmin } from "@/types/admin.type";
import { doesAdminHaveAnyPermission, isSuperadmin } from "@/utils/adminAccess.util";
import { sessionCookieNames } from "@/config/sessionCookies.config";

const maximumForwardedBodyBytes = 2 * 1024 * 1024;
const forwardedRequestHeaderNames = ["idempotency-key", "if-match"];
const returnedResponseHeaderNames = ["content-type", "content-disposition", "idempotent-replayed", "retry-after", "etag"];
const allowedApiPathPattern = /^\/admin(\/[A-Za-z0-9._~:@%-]+)+$/;

export function readBackendErrorCode(result: BackendResult): string | null {
  try {
    const parsed = JSON.parse(Buffer.from(result.body).toString("utf8")) as { code?: unknown };
    return typeof parsed.code === "string" ? parsed.code : null;
  } catch {
    return null;
  }
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

function doesAdminSatisfyApiRequirement(admin: SignedInAdmin, requirement: ApiAccessRequirement): boolean {
  if (requirement.kind === "ownAccount") return true;
  if (requirement.kind === "superadmin") return isSuperadmin(admin);
  return doesAdminHaveAnyPermission(admin, requirement.permissions);
}

function parseJsonBody(body: Uint8Array | null): unknown {
  if (!body || body.byteLength === 0) return null;
  try {
    return JSON.parse(Buffer.from(body).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function doesRouteNeedStepUp(route: ResolvedApiRoute, body: unknown): boolean {
  return route.stepUp || (route.stepUpWhenBody?.(body) ?? false);
}

function respondWithEndedSession(code: string, message: string): NextResponse {
  const response = respondWithBffError(401, code, message);
  clearEverySessionCookie(response.cookies);
  return response;
}

function collectForwardedHeaders(request: NextRequest, stepUpToken: string | null): Record<string, string> {
  const forwardedHeaders: Record<string, string> = { "User-Agent": readClientUserAgent(request) };
  for (const headerName of forwardedRequestHeaderNames) {
    const headerValue = request.headers.get(headerName);
    if (headerValue && headerValue.length <= 256) forwardedHeaders[headerName] = headerValue;
  }
  const clientAddress = readClientIpAddress(request);
  if (clientAddress) forwardedHeaders["X-Forwarded-For"] = clientAddress;
  if (stepUpToken) forwardedHeaders["X-Step-Up-Token"] = stepUpToken;
  return forwardedHeaders;
}

export async function forwardBffRequestToAdminApi(request: NextRequest, pathSegments: readonly string[]): Promise<NextResponse> {
  const apiPath = `/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  if (!allowedApiPathPattern.test(apiPath) || apiPath.includes("..") || apiPath.startsWith("/admin/auth")) return respondWithBffError(404, "NOT_FOUND", "This endpoint is not available.");
  const route = findAdminApiRoute(request.method, apiPath);
  if (!route) return respondWithBffError(404, "NOT_FOUND", "This endpoint is not available.");

  const envelope = readSessionEnvelopeFromCookies(request.cookies);
  if (!envelope) return respondWithEndedSession("UNAUTHENTICATED", "Sign in to continue.");
  if (!isSafeHttpMethod(request.method) && !isMutationProtectedAgainstCsrf(request)) {
    return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified. Reload the page and try again.");
  }
  let view: CachedSessionView | null = readCachedSessionViewFromCookies(request.cookies);
  if (!view) return respondWithEndedSession("SESSION_IDLE_TIMEOUT", "You were signed out after 15 minutes without activity.");

  const tokens = readApiTokensFromCookies(request.cookies);
  let rotatedTokens: ApiTokenPair | null = null;
  if (isCachedSessionViewStale(view)) {
    const revalidated = await revalidateAdminWithBackend(tokens);
    if (!revalidated) return respondWithEndedSession("SESSION_EXPIRED", "Your session has ended. Sign in again.");
    if (havePrivilegesChanged(view.admin, revalidated.admin)) return respondWithEndedSession("SESSION_PRIVILEGES_CHANGED", "Your admin access changed. Sign in again to continue.");
    rotatedTokens = revalidated.rotatedTokens;
    view = { ...view, admin: revalidated.admin, verifiedAtEpochSeconds: nowInEpochSeconds() };
  }
  if (!doesAdminSatisfyApiRequirement(view.admin, route.requirement)) return respondWithBffError(403, "FORBIDDEN", "Your admin permissions do not allow this.");

  const body = await readRequestBodyWithinLimit(request);
  if (body === "too_large") return respondWithBffError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
  const parsedBody = parseJsonBody(body);
  if (isReasonMissing(route, parsedBody)) {
    return respondWithBffError(400, "REASON_REQUIRED", `Add a reason of at least ${minimumReasonLength} characters. It is saved in the audit log.`, { issues: [{ field: "reason", message: "Reason is required." }] });
  }
  const stepUpToken = readStepUpTokenForSession(request.cookies, envelope.sessionId);
  if (doesRouteNeedStepUp(route, parsedBody) && !stepUpToken) {
    return respondWithBffError(403, "STEP_UP_REQUIRED", "Confirm it's you with your authenticator code to continue.");
  }

  const forwardedHeaders = collectForwardedHeaders(request, stepUpToken);
  let accessToken = rotatedTokens?.accessToken ?? tokens.accessToken;
  const sendToBackend = () => callAdminBackend({ method: request.method, path: apiPath, query: request.nextUrl.searchParams, body, contentType: request.headers.get("content-type"), accessToken, forwardedHeaders });

  let backendResult = await sendToBackend();
  if (backendResult.status === 401 && readBackendErrorCode(backendResult) === "STEP_UP_REUSED") {
    const reused = respondWithBffError(403, "STEP_UP_REQUIRED", "Each money action needs a fresh code. Confirm it's you with your authenticator code.");
    clearCookieByName(reused.cookies, sessionCookieNames.stepUp);
    return reused;
  }
  const refreshTokenToUse = rotatedTokens?.refreshToken ?? tokens.refreshToken;
  if (backendResult.status === 401 && refreshTokenToUse) {
    const retriedTokens = await exchangeRefreshTokenForNewTokenPair(refreshTokenToUse);
    if (!retriedTokens) return respondWithEndedSession("SESSION_EXPIRED", "Your session has ended. Sign in again.");
    rotatedTokens = retriedTokens;
    accessToken = retriedTokens.accessToken;
    backendResult = await sendToBackend();
  }
  if (backendResult.status === 401) return respondWithEndedSession("SESSION_EXPIRED", "Your session has ended. Sign in again.");

  const response = convertBackendResultToResponse(backendResult);
  if (route.singleUseStepUp) clearCookieByName(response.cookies, sessionCookieNames.stepUp);
  writeCachedSessionViewCookie(response.cookies, { ...view, lastActivityAtEpochSeconds: nowInEpochSeconds() });
  if (rotatedTokens) writeApiTokenCookies(response.cookies, rotatedTokens);
  return response;
}
