import type { MockRequest, MockResponse } from "@/mocks/mockRouter.mock";

export class MockHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: readonly { path: string; message: string }[] = [],
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function respondWithJson(status: number, body: unknown): MockResponse {
  return { status, body };
}

export function respondWithError(status: number, code: string, message: string, issues: readonly { path: string; message: string }[] = [], extra: Record<string, unknown> = {}): MockResponse {
  return { status, body: { message, code, ...(issues.length > 0 ? { issues } : {}), ...extra } };
}

export function respondWithNoContent(): MockResponse {
  return { status: 204, body: null };
}

export function respondWithDownload(fileName: string, text: string, contentType: string): MockResponse {
  return { status: 200, body: text, contentType, headers: { "Content-Disposition": `attachment; filename="${fileName}"` } };
}

export function readJsonObjectBody(request: MockRequest): Record<string, unknown> {
  const body = request.jsonBody;
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new MockHttpError(400, "VALIDATION_FAILED", "Send a JSON object.");
  return body as Record<string, unknown>;
}

export function failValidation(path: string, message: string): never {
  throw new MockHttpError(400, "VALIDATION_FAILED", message, [{ path, message }]);
}

export function failNotFound(what: string): never {
  throw new MockHttpError(404, "NOT_FOUND", `${what} was not found.`);
}

export function failConflict(code: string, message: string): never {
  throw new MockHttpError(409, code, message);
}

export function readRequiredTrimmedString(body: Record<string, unknown>, fieldName: string, maximumLength: number, minimumLength = 1): string {
  const value = body[fieldName];
  if (typeof value !== "string" || value.trim().length < minimumLength) failValidation(fieldName, minimumLength > 1 ? `${fieldName} needs at least ${minimumLength} characters.` : `${fieldName} is required.`);
  if (value.trim().length > maximumLength) failValidation(fieldName, `${fieldName} can be at most ${maximumLength} characters.`);
  return value.trim();
}

export function readOptionalTrimmedString(body: Record<string, unknown>, fieldName: string, maximumLength: number): string | null {
  const value = body[fieldName];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") failValidation(fieldName, `${fieldName} must be text.`);
  if (value.trim().length > maximumLength) failValidation(fieldName, `${fieldName} can be at most ${maximumLength} characters.`);
  return value.trim();
}

export function readRequiredReason(body: Record<string, unknown>): string {
  return readRequiredTrimmedString(body, "reason", 1000, 5);
}

export function readEnumValue<Value extends string>(body: Record<string, unknown>, fieldName: string, allowedValues: readonly Value[]): Value {
  const value = body[fieldName];
  if (typeof value !== "string" || !(allowedValues as readonly string[]).includes(value)) failValidation(fieldName, `${fieldName} must be one of ${allowedValues.join(", ")}.`);
  return value as Value;
}

export function paginateItems<Item>(items: readonly Item[], request: MockRequest, defaultPageSize = 25) {
  const pageSize = Math.min(Math.max(Number(request.query.get("pageSize") ?? defaultPageSize) || defaultPageSize, 1), 200);
  const page = Math.max(Number(request.query.get("page") ?? 1) || 1, 1);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length };
}

export function paginateByCursor<Item>(items: readonly Item[], request: MockRequest, defaultLimit = 25) {
  const limit = Math.min(Math.max(Number(request.query.get("limit") ?? defaultLimit) || defaultLimit, 1), 100);
  const offset = Math.max(Number(request.query.get("cursor") ?? 0) || 0, 0);
  return { items: items.slice(offset, offset + limit), nextCursor: offset + limit < items.length ? String(offset + limit) : null };
}

export function matchesSearchText(searchText: string | null, ...fields: readonly (string | null | undefined)[]): boolean {
  if (!searchText) return true;
  const needle = searchText.trim().toLowerCase();
  return fields.some((field) => (field ?? "").toLowerCase().includes(needle));
}

let mockIdCounter = 1000;

export function createMockId(prefix: string): string {
  mockIdCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${mockIdCounter.toString(36)}`;
}

export function readIsoNow(): string {
  return new Date().toISOString();
}

export function readIsoTimeOffset(offsetInMinutes: number): string {
  return new Date(Date.now() + offsetInMinutes * 60_000).toISOString();
}
