import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { registerEveryMockHandler } from "@/mocks/mockHandlerRegistry.mock";
import { MockHttpError, respondWithError } from "@/mocks/mockResponses.mock";
import { advanceMockReviewQueue } from "@/mocks/mockReviewQueue.mock";
import { findMockRouteForRequest, type MockPrincipal, type MockResponse } from "@/mocks/mockRouter.mock";

export interface MockApiCall {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Headers;
  readonly body: Uint8Array | null;
}

let areMockHandlersRegistered = false;

function resolveMockPrincipalFromHeaders(headers: Headers): MockPrincipal | null {
  const database = readMockDatabase();
  const bearerToken = headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const tokenRecord = database.accessTokens.get(bearerToken);
  if (!tokenRecord || tokenRecord.expiresAtEpochMs < Date.now()) return null;
  const user = database.users.find((candidate) => candidate.id === tokenRecord.userId);
  return user ? { userId: user.id, actorName: user.name } : null;
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

function replayOrRememberIdempotentResponse(call: MockApiCall, principal: MockPrincipal | null, produce: () => Promise<MockResponse>): Promise<MockResponse> {
  const idempotencyKey = call.headers.get("idempotency-key");
  if (!idempotencyKey || call.method === "GET") return produce();
  const database = readMockDatabase();
  const storageKey = `${principal?.userId ?? "anonymous"}:${call.method}:${call.path}:${idempotencyKey}`;
  const requestBody = call.body ? new TextDecoder().decode(call.body) : "";
  const remembered = database.idempotentResponses.get(storageKey);
  if (remembered && remembered.requestBody !== undefined && remembered.requestBody !== requestBody) return Promise.resolve(respondWithError(409, "IDEMPOTENCY_KEY_REUSED", "This payment key was already used for a different request."));
  if (remembered) return Promise.resolve({ status: remembered.status, body: remembered.body, headers: { "Idempotent-Replayed": "true" } });
  return produce().then((response) => {
    if (response.status < 500) database.idempotentResponses.set(storageKey, { status: response.status, body: response.body, requestBody });
    return response;
  });
}

export async function dispatchMockApiRequest(call: MockApiCall): Promise<MockResponse> {
  if (!areMockHandlersRegistered) {
    registerEveryMockHandler();
    areMockHandlersRegistered = true;
  }
  advanceMockReviewQueue();
  const matched = findMockRouteForRequest(call.method, call.path);
  if (!matched) return respondWithError(404, "NOT_FOUND", `No mock for ${call.method} ${call.path}.`);
  try {
    const principal = resolveMockPrincipalFromHeaders(call.headers);
    if (matched.route.requiresPrincipal && !principal) return respondWithError(401, "UNAUTHENTICATED", "Your session has expired. Sign in again.");
    return await replayOrRememberIdempotentResponse(call, principal, async () =>
      matched.route.handler({ method: call.method, path: call.path, params: matched.params, query: call.query, jsonBody: parseJsonBodyIfPresent(call.headers, call.body), binaryBody: call.body, headers: call.headers, principal }),
    );
  } catch (error) {
    if (error instanceof MockHttpError) return respondWithError(error.status, error.code, error.message, error.issues);
    console.error("Mock handler failed", error);
    return respondWithError(500, "MOCK_FAILURE", "The demo backend hit an error.");
  }
}

(globalThis as Record<string, unknown>).__zudomartMockBackend = "zudomart-mock-backend-bundled";
