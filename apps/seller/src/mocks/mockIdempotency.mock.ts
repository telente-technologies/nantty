import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { MockRequest, MockResponse } from "@/mocks/mockRouter.mock";
import { requireIdempotencyKey } from "@/mocks/mockResponses.mock";

export async function runOnceForIdempotencyKey(request: MockRequest, produceResponse: () => MockResponse | Promise<MockResponse>): Promise<MockResponse> {
  const idempotencyKey = requireIdempotencyKey(request);
  const database = readMockDatabase();
  const scopedKey = `${request.principal?.storeId ?? "anonymous"}:${request.method}:${request.path}:${idempotencyKey}`;
  const storedResponse = database.idempotentResponses.get(scopedKey);
  if (storedResponse) return { ...storedResponse, headers: { ...storedResponse.headers, "Idempotent-Replayed": "true" } };
  const response = await produceResponse();
  if (response.status < 500) database.idempotentResponses.set(scopedKey, response);
  return response;
}
