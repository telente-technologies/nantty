import { type HttpResponseContext, type HttpRouterContext } from "@nantty/fastify-platform";
import type { Infer, Schema } from "@nantty/fastify-platform";

import { badRequest } from "../errors/social.error.js";
import { findPrincipal, requirePrincipal } from "../middlewares/principal.middleware.js";
import type { Principal } from "../types/principal.type.js";
import { empty, errorToResponse, json, parseJsonBody, validationFailed } from "./http.util.js";
import type { IdempotencyGuard } from "../middlewares/idempotency.middleware.js";
import { runWithViewerAgeBracket } from "./viewerAgeContext.util.js";

type Parsed<S> = S extends Schema<unknown> ? Infer<S> : undefined;

export interface RouteDefinition<P, Q, B> {
  readonly authentication: "required" | "optional";
  readonly params?: P;
  readonly query?: Q;
  readonly body?: B;
  readonly successStatus?: number;
  readonly idempotent?: boolean;
}

export interface RouteInput<P, Q, B, A extends Principal | undefined> {
  readonly principal: A;
  readonly params: Parsed<P>;
  readonly query: Parsed<Q>;
  readonly body: Parsed<B>;
  readonly idempotencyKey: string | undefined;
}

export type RouteFactory = <P extends Schema<unknown> | undefined, Q extends Schema<unknown> | undefined, B extends Schema<unknown> | undefined, A extends "required" | "optional">(
  definition: RouteDefinition<P, Q, B> & { readonly authentication: A },
  handler: (input: RouteInput<P, Q, B, A extends "required" ? Principal : Principal | undefined>) => Promise<unknown>,
) => (context: HttpRouterContext) => Promise<HttpResponseContext>;

function parseWith(schema: Schema<unknown> | undefined, value: unknown): { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly response: HttpResponseContext } {
  if (schema === undefined) return { ok: true, data: undefined };
  const result = schema.safeParse(value);
  if (!result.success) return { ok: false, response: validationFailed(result.error.issues) };
  return { ok: true, data: result.data };
}

function normaliseQuery(query: Readonly<Record<string, string | string[]>>): Record<string, string> {
  return Object.fromEntries(Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? "") : value]));
}

export function createRouteFactory(idempotency: IdempotencyGuard): RouteFactory {
  return (definition, handler) => async (context) => {
    try {
      const principal = definition.authentication === "required" ? requirePrincipal(context) : findPrincipal(context);
      const params = parseWith(definition.params, context.params);
      if (!params.ok) return params.response;
      const query = parseWith(definition.query, normaliseQuery(context.query));
      if (!query.ok) return query.response;
      const rawBody = parseJsonBody(context.request.body);
      const body = parseWith(definition.body, rawBody);
      if (!body.ok) return body.response;
      const key = context.request.getHeader("idempotency-key")?.trim();
      if (key !== undefined && key !== "" && !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw badRequest("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 8 to 128 characters of letters, digits, - or _.");
      const execute = () => runWithViewerAgeBracket(principal?.ageBracket ?? "unknown", async () => {
        const result = await handler({ principal, params: params.data, query: query.data, body: body.data, idempotencyKey: key === "" ? undefined : key } as never);
        return { status: definition.successStatus ?? (result === undefined ? 204 : 200), body: result };
      });
      const outcome = principal !== undefined && key !== undefined && key !== "" && context.request.method !== "GET"
        ? await idempotency.run({ accountId: principal.accountId, key, method: context.request.method, requestPath: context.request.path, body: rawBody }, execute)
        : { ...(await execute()), replayed: false };
      const response = outcome.body === undefined || outcome.body === null ? empty(outcome.status) : json(outcome.status, outcome.body);
      if (outcome.replayed) response.setHeader("idempotent-replayed", "true");
      return response;
    } catch (error) {
      const response = errorToResponse(error);
      if (response !== undefined) return response;
      throw error;
    }
  };
}

