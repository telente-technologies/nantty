import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { registerEveryMockHandler } from "@/mocks/mockHandlerRegistry.mock";
import { findMockMembershipForUserAndStore } from "@/mocks/mockStoreMembership.mock";
import { MockHttpError, respondWithError } from "@/mocks/mockResponses.mock";
import { findMockRouteForRequest, type MockPrincipal, type MockResponse } from "@/mocks/mockRouter.mock";
import { runWithinMockStoreScope } from "@/mocks/mockStoreScope.mock";

export interface MockApiCall {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Headers;
  readonly body: Uint8Array | null;
}

let areMockHandlersRegistered = false;

function ensureMockHandlersAreRegistered(): void {
  if (areMockHandlersRegistered) return;
  registerEveryMockHandler();
  areMockHandlersRegistered = true;
}

function resolveMockPrincipalFromHeaders(headers: Headers): MockPrincipal | null {
  const database = readMockDatabase();
  const bearerToken = headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const tokenRecord = database.accessTokens.get(bearerToken);
  if (!tokenRecord || tokenRecord.expiresAtEpochMs < Date.now()) return null;
  const session = [...database.apiSessions.values()].find((candidate) => candidate.sessionId === tokenRecord.sessionId);
  if (!session || session.revoked) return null;
  const user = database.users.find((candidate) => candidate.id === tokenRecord.userId);
  if (!user) return null;
  const membership = findMockMembershipForUserAndStore(user.id, headers.get("x-seller-store"));
  const principal: MockPrincipal = { userId: user.id, storeId: membership?.storeId ?? null, role: membership?.role ?? null, staffId: membership?.staffId ?? null, actorName: user.name };
  return principal;
}

function parseJsonBodyIfPresent(headers: Headers, body: Uint8Array | null): unknown {
  if (!body || body.byteLength === 0) return undefined;
  if (!(headers.get("content-type") ?? "").includes("application/json")) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new MockHttpError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
}

export async function dispatchMockApiRequest(call: MockApiCall): Promise<MockResponse> {
  ensureMockHandlersAreRegistered();
  const matched = findMockRouteForRequest(call.method, call.path);
  if (!matched) return respondWithError(404, "NOT_FOUND", `No mock for ${call.method} ${call.path}.`);
  try {
    const principal = resolveMockPrincipalFromHeaders(call.headers);
    if (matched.route.requiresPrincipal && !principal) return respondWithError(401, "UNAUTHENTICATED", "Your session has expired. Sign in again.");
    if (principal && call.headers.get("x-seller-store") && principal.storeId === null) return respondWithError(403, "NOT_A_STORE_MEMBER", "You are not a member of that store.");
    const handler = matched.route.handler;
    return await runWithinMockStoreScope(principal?.storeId ?? null, () => handler({
      method: call.method,
      path: call.path,
      params: matched.params,
      query: call.query,
      jsonBody: parseJsonBodyIfPresent(call.headers, call.body),
      binaryBody: call.body,
      headers: call.headers,
      principal,
      locationId: call.headers.get("x-seller-location"),
    }));
  } catch (error) {
    if (error instanceof MockHttpError) return error.status === 402 && error.code === "PLAN_FEATURE_REQUIRED" ? { status: 402, body: { message: error.message, code: error.code, requiredPlan: /business/i.test(error.message) ? "business" : "pro" } } : respondWithError(error.status, error.code, error.message);
    console.error("Mock handler failed", error);
    return respondWithError(500, "MOCK_FAILURE", "The demo backend hit an error.");
  }
}

(globalThis as Record<string, unknown>).__nanttyMockBackend = "nantty-mock-backend-bundled";
