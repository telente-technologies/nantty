import { createResponseContext, type HttpResponseContext } from "@nantty/fastify-platform";
import type { Schema, SchemaIssue } from "@nantty/fastify-platform";

import { SupportError } from "../errors/support.error.js";

export function json(status: number, data: unknown): HttpResponseContext {
  return createResponseContext({ status }).json(data);
}

export function empty(status = 204): HttpResponseContext {
  return createResponseContext({ status });
}

function describeIssues(issues: readonly SchemaIssue[]): string {
  return issues.map((issue) => `${issue.path.map(String).join(".") || "body"}: ${issue.message}`).join("; ");
}

export function errorToResponse(error: unknown): HttpResponseContext | undefined {
  if (!(error instanceof SupportError)) return undefined;
  return json(error.status, { message: error.message, code: error.code });
}

export function parseJsonBody(body: unknown): unknown {
  if (body === undefined || body === null) return undefined;
  const text = body instanceof Uint8Array ? new TextDecoder().decode(body) : typeof body === "string" ? body : undefined;
  if (text === undefined) return body;
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SupportError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
}

export function parseWithSchema<T>(definition: Schema<T>, value: unknown): T {
  const result = definition.safeParse(value ?? {});
  if (!result.success) throw new SupportError(400, "VALIDATION_FAILED", describeIssues(result.error.issues));
  return result.data;
}

export function flattenQuery(query: Readonly<Record<string, string | string[]>>): Record<string, string> {
  return Object.fromEntries(Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? "") : value]));
}

export function readPage(query: Record<string, string>, maximum: number, fallbackSize: number): { readonly page: number; readonly pageSize: number } {
  const page = Math.max(1, Math.floor(Number(query["page"] ?? "1")) || 1);
  const pageSize = Math.min(maximum, Math.max(1, Math.floor(Number(query["pageSize"] ?? String(fallbackSize))) || fallbackSize));
  return { page, pageSize };
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readUuidParam(params: Readonly<Record<string, string>>, name: string, what: string): string {
  const value = params[name] ?? "";
  if (!uuidPattern.test(value)) throw new SupportError(404, "NOT_FOUND", `${what} not found.`);
  return value.toLowerCase();
}
