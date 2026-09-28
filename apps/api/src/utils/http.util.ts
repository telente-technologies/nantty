import {
  badRequest,
  createResponseContext,
  type HttpMiddleware,
  type HttpResponseContext,
  type HttpRouterContext,
} from "@zudojs/http";
import type { SchemaIssue } from "@zudojs/schema";
import { generateSecurityHeaders } from "@zudojs/security";

export function json(status: number, data: unknown): HttpResponseContext {
  return createResponseContext({ status }).json(data);
}

export function empty(status: number): HttpResponseContext {
  return createResponseContext({ status });
}

export function validationFailed(issues: readonly SchemaIssue[]): HttpResponseContext {
  return json(400, {
    error: "Validation failed",
    issues: issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })),
  });
}

export function readJsonBody(ctx: HttpRouterContext): unknown {
  const body: unknown = ctx.request.body;
  if (body === undefined || body === null) return undefined;
  const text =
    body instanceof Uint8Array
      ? new TextDecoder().decode(body)
      : typeof body === "string"
        ? body
        : undefined;
  if (text === undefined) return body;
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw badRequest("The request body is not valid JSON.");
  }
}

export function errorResponse(error: unknown): HttpResponseContext | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as {
    readonly statusCode?: unknown;
    readonly expose?: unknown;
    readonly message?: unknown;
    readonly code?: unknown;
  };
  const status = candidate.statusCode;
  if (typeof status !== "number" || status < 400 || status > 599) return undefined;
  if (candidate.expose !== true || typeof candidate.message !== "string") return undefined;
  return json(status, {
    error: candidate.message,
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
  });
}

export function errorDetails(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) return { error: String(error) };
  const { code } = error as { readonly code?: unknown };
  return {
    error: error.message,
    name: error.name,
    ...(typeof code === "string" ? { code } : {}),
    ...(error.stack === undefined ? {} : { stack: error.stack }),
    ...(error.cause === undefined ? {} : { cause: error.cause instanceof Error ? error.cause.message : String(error.cause) }),
  };
}

export function securityHeaders(): HttpMiddleware {
  const defaults = Object.entries(generateSecurityHeaders());
  return async (_context, next) => {
    const response = (await next()).clone();
    const present = new Set(Object.keys(response.headers).map((name) => name.toLowerCase()));
    for (const [name, value] of defaults) {
      if (!present.has(name.toLowerCase())) response.setHeader(name, value);
    }
    return response;
  };
}
