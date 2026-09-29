import type { MockRequest, MockResponse } from "@/mocks/mockRouter.mock";

export class MockHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: readonly { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

export function respondWithJson(status: number, body: unknown): MockResponse {
  return { status, body };
}

export function respondWithError(status: number, code: string, message: string, issues: readonly { path: string; message: string }[] = []): MockResponse {
  return { status, body: issues.length > 0 ? { message, code, issues } : { message, code } };
}

export function respondWithNoContent(): MockResponse {
  return { status: 204, body: null };
}

export function respondWithDownload(fileName: string, text: string, contentType: string): MockResponse {
  return { status: 200, body: text, contentType, headers: { "Content-Disposition": `attachment; filename="${fileName}"` } };
}

export function requirePrincipal(request: MockRequest) {
  if (!request.principal) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.principal;
}

export function readJsonObjectBody(request: MockRequest): Record<string, unknown> {
  const body = request.jsonBody;
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new MockHttpError(400, "VALIDATION_FAILED", "Send a JSON object.");
  return body as Record<string, unknown>;
}

export function failValidation(path: string, message: string): never {
  throw new MockHttpError(400, "VALIDATION_FAILED", message, [{ path, message }]);
}

export function readRequiredTrimmedString(body: Record<string, unknown>, fieldName: string, maximumLength: number): string {
  const value = body[fieldName];
  if (typeof value !== "string" || value.trim().length === 0) failValidation(fieldName, `${fieldName} is required.`);
  if (value.trim().length > maximumLength) failValidation(fieldName, `${fieldName} can be at most ${maximumLength} characters.`);
  return value.trim();
}

export function paginateItems<Item>(items: readonly Item[], request: MockRequest, defaultLimit = 50) {
  const limit = Math.min(Math.max(Number(request.query.get("limit") ?? defaultLimit) || defaultLimit, 1), 200);
  const offset = Math.max(Number(request.query.get("cursor") ?? 0) || 0, 0);
  const pageItems = items.slice(offset, offset + limit);
  return { items: pageItems, nextCursor: offset + limit < items.length ? String(offset + limit) : null, total: items.length };
}

let mockIdCounter = 1000;

export function createMockId(prefix: string): string {
  mockIdCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${mockIdCounter.toString(36)}`;
}

export function readIsoNow(): string {
  return new Date().toISOString();
}
