import { doesApiCallRequireStepUp } from "@/config/apiAccess.config";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockStepUp } from "@/mocks/mockGuards.mock";
import { registerEveryMockHandler } from "@/mocks/mockHandlerRegistry.mock";
import { MockHttpError, respondWithError } from "@/mocks/mockResponses.mock";
import { clearEveryMockRoute, findMockRouteForRequest, type MockPrincipal, type MockResponse } from "@/mocks/mockRouter.mock";

export interface MockApiCall {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Headers;
  readonly body: Uint8Array | null;
}

let areHandlersRegisteredForThisModuleInstance = false;

function ensureMockHandlersAreRegistered(): void {
  if (areHandlersRegisteredForThisModuleInstance) return;
  clearEveryMockRoute();
  registerEveryMockHandler();
  areHandlersRegisteredForThisModuleInstance = true;
}

function resolveMockPrincipalFromHeaders(headers: Headers): MockPrincipal | null {
  const database = readMockDatabase();
  const bearerToken = headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const tokenRecord = database.accessTokens.get(bearerToken);
  if (!tokenRecord || tokenRecord.expiresAtEpochMs < Date.now()) return null;
  const session = database.adminSessions.get(tokenRecord.sessionId);
  const admin = database.admins.find((candidate) => candidate.id === tokenRecord.adminId);
  if (!admin || admin.status !== "ACTIVE" || !session || session.revoked) return null;
  session.lastSeenAt = new Date().toISOString();
  return { adminId: admin.id, name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions, sessionId: session.id };
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

async function replayOrRememberIdempotentResponse(call: MockApiCall, principal: MockPrincipal | null, produce: () => Promise<MockResponse>): Promise<MockResponse> {
  const idempotencyKey = call.headers.get("idempotency-key");
  if (!idempotencyKey || call.method === "GET") return produce();
  const database = readMockDatabase();
  const storageKey = `${principal?.adminId ?? "anonymous"}:${call.method}:${call.path}:${idempotencyKey}`;
  const remembered = database.idempotentResponses.get(storageKey);
  if (remembered) return { status: remembered.status, body: remembered.body, headers: { "Idempotent-Replayed": "true" } };
  const response = await produce();
  if (response.status < 500) database.idempotentResponses.set(storageKey, { status: response.status, body: response.body });
  return response;
}

export async function dispatchMockApiRequest(call: MockApiCall): Promise<MockResponse> {
  ensureMockHandlersAreRegistered();
  const matched = findMockRouteForRequest(call.method, call.path);
  if (!matched) return respondWithError(404, "NOT_FOUND", `No mock for ${call.method} ${call.path}.`);
  try {
    const principal = resolveMockPrincipalFromHeaders(call.headers);
    if (matched.route.requiresPrincipal && !principal) return respondWithError(401, "UNAUTHENTICATED", "Your session has expired. Sign in again.");
    const jsonBody = parseJsonBodyIfPresent(call.headers, call.body);
    const request = { method: call.method, path: call.path, params: matched.params, query: call.query, jsonBody, headers: call.headers, principal };
    if (principal && doesApiCallRequireStepUp(call.method, call.path, jsonBody)) requireMockStepUp(request);
    return await replayOrRememberIdempotentResponse(call, principal, async () => matched.route.handler(request));
  } catch (error) {
    if (error instanceof MockHttpError) return respondWithError(error.status, error.code, error.message, error.issues, error.extra);
    console.error("Mock handler failed", error);
    return respondWithError(500, "MOCK_FAILURE", "The demo backend hit an error.");
  }
}

(globalThis as Record<string, unknown>).__nanttyMockBackend = "nantty-mock-backend-bundled";
