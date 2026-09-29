import type { MockPrincipal, MockRequest, MockResponse } from "@/mocks/mockRouter.mock";
import type { CursorPage } from "@/types/pagination.type";

export function respondWithJson(status: number, body: unknown): MockResponse {
  return { status, body };
}

export function respondWithError(status: number, code: string, message: string): MockResponse {
  return { status, body: { message, code } };
}

export function respondWithValidationFailure(issues: { path: string; message: string }[]): MockResponse {
  return { status: 400, body: { message: "Validation failed", code: "VALIDATION_FAILED", issues } };
}

export function respondWithNoContent(): MockResponse {
  return { status: 204, body: null };
}

export function respondWithCsv(fileName: string, csvText: string): MockResponse {
  return {
    status: 200,
    body: csvText,
    contentType: "text/csv; charset=utf-8",
    headers: { "Content-Disposition": `attachment; filename="${fileName}"` },
  };
}

export class MockHttpError extends Error {
  public constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export function requireMockStorePrincipal(request: MockRequest): MockPrincipal & { readonly storeId: string } {
  const principal = request.principal;
  if (!principal) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (!principal.storeId || !principal.role) throw new MockHttpError(403, "NOT_A_SELLER", "This account does not manage a store.");
  return principal as MockPrincipal & { readonly storeId: string };
}

export function readJsonObjectBody(request: MockRequest): Record<string, unknown> {
  const body = request.jsonBody;
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new MockHttpError(400, "INVALID_BODY", "Send a JSON object.");
  return body as Record<string, unknown>;
}

export function requireIdempotencyKey(request: MockRequest): string {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
    throw new MockHttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "This request needs an Idempotency-Key header.");
  }
  return idempotencyKey;
}

export function paginateMockList<Item>(items: readonly Item[], query: URLSearchParams, defaultLimit = 25): CursorPage<Item> {
  const requestedLimit = Number(query.get("limit") ?? defaultLimit);
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 200) : defaultLimit;
  const startIndex = Math.max(0, Number(query.get("cursor") ?? 0) || 0);
  const pageItems = items.slice(startIndex, startIndex + limit);
  const nextIndex = startIndex + limit;
  return { data: pageItems, nextCursor: nextIndex < items.length ? String(nextIndex) : null };
}

export function matchesSearchText(searchText: string | null, ...fields: (string | null | undefined)[]): boolean {
  if (!searchText) return true;
  const needle = searchText.trim().toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

export function readDateRangeFromQuery(query: URLSearchParams, defaultDays = 30): { from: Date; to: Date } {
  const to = query.get("to") ? new Date(`${query.get("to")}T23:59:59.999Z`) : new Date();
  const from = query.get("from") ? new Date(`${query.get("from")}T00:00:00.000Z`) : new Date(to.getTime() - defaultDays * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new MockHttpError(400, "INVALID_DATE_RANGE", "Pick a valid date range.");
  return { from, to };
}

export function createMockIdentifier(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
