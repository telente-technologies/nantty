import { createResponseContext, type HttpRequestContext, type HttpResponseContext } from "@nantty/fastify-platform";

import { ApiError, validationError } from "../errors/notifications.error.js";

export function json(status: number, data: unknown): HttpResponseContext {
  return createResponseContext({ status }).json(data);
}

export function emptyResponse(status = 204): HttpResponseContext {
  return createResponseContext({ status });
}

export function convertErrorToResponse(error: unknown): HttpResponseContext {
  if (error instanceof ApiError) return json(error.status, { message: error.message, code: error.code, ...(error.issues === undefined ? {} : { issues: error.issues }) });
  return json(500, { message: "Something went wrong. Try again.", code: "INTERNAL_ERROR" });
}

export function readJsonBody(request: HttpRequestContext): Record<string, unknown> {
  const body: unknown = request.body;
  let parsed: unknown = body;
  if (body instanceof Uint8Array) parsed = body.byteLength === 0 ? {} : safeParse(new TextDecoder().decode(body));
  else if (typeof body === "string") parsed = body === "" ? {} : safeParse(body);
  if (parsed === undefined || parsed === null) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) throw validationError("The request body must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw validationError("The request body is not valid JSON.");
  }
}

export function readQuery(request: HttpRequestContext): URLSearchParams {
  return new URL(request.url, "http://notifications.internal").searchParams;
}

export function readBoundedLimit(query: URLSearchParams, fallback = 30, maximum = 100): number {
  const raw = query.get("limit");
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw validationError("limit must be a positive integer.");
  return Math.min(value, maximum);
}
