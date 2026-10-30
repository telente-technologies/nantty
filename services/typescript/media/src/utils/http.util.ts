import { createResponseContext, type HttpResponseContext } from "@nantty/fastify-platform";
import type { SchemaIssue } from "@nantty/fastify-platform";

import { MediaError } from "../errors/media.error.js";

export function json(status: number, data: unknown): HttpResponseContext {
  return createResponseContext({ status }).json(data);
}

export function empty(status: number): HttpResponseContext {
  return createResponseContext({ status });
}

export function validationFailed(issues: readonly SchemaIssue[]): HttpResponseContext {
  return json(400, {
    message: "Validation failed",
    code: "VALIDATION_FAILED",
    issues: issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message })),
  });
}

export function errorToResponse(error: unknown): HttpResponseContext | undefined {
  if (!(error instanceof MediaError)) return undefined;
  return json(error.status, { ...(error.details ?? {}), message: error.message, code: error.code });
}

export function parseJsonBody(body: unknown): unknown {
  if (body === undefined || body === null) return undefined;
  const text = body instanceof Uint8Array ? new TextDecoder().decode(body) : typeof body === "string" ? body : undefined;
  if (text === undefined) return body;
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MediaError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
}
