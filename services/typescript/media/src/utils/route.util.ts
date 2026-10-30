import { type HttpResponseContext, type HttpRouterContext } from "@nantty/fastify-platform";
import type { Infer, Schema } from "@nantty/fastify-platform";

import { badRequest } from "../errors/media.error.js";
import { requireInternalCaller, requirePrincipal } from "../middlewares/principal.middleware.js";
import type { Principal } from "../types/principal.type.js";
import { empty, errorToResponse, json, parseJsonBody, validationFailed } from "./http.util.js";

type Parsed<S> = S extends Schema<unknown> ? Infer<S> : undefined;

export interface RouteDefinition<P, Q, B> {
  readonly authentication: "user" | "internal";
  readonly params?: P;
  readonly query?: Q;
  readonly body?: B;
  readonly rawBody?: boolean;
  readonly successStatus?: number;
}

export interface RouteInput<P, Q, B> {
  readonly principal: Principal;
  readonly params: Parsed<P>;
  readonly query: Parsed<Q>;
  readonly body: Parsed<B>;
  readonly rawBody: Uint8Array;
  readonly idempotencyKey: string | undefined;
  readonly sha256Header: string | undefined;
}

export type RouteFactory = <P extends Schema<unknown> | undefined, Q extends Schema<unknown> | undefined, B extends Schema<unknown> | undefined>(
  definition: RouteDefinition<P, Q, B>,
  handler: (input: RouteInput<P, Q, B>) => Promise<unknown>,
) => (context: HttpRouterContext) => Promise<HttpResponseContext>;

function parseWith(schema: Schema<unknown> | undefined, value: unknown): { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly response: HttpResponseContext } {
  if (schema === undefined) return { ok: true, data: undefined };
  const result = schema.safeParse(value);
  return result.success ? { ok: true, data: result.data } : { ok: false, response: validationFailed(result.error.issues) };
}

const firstQueryValues = (query: Readonly<Record<string, string | string[]>>): Record<string, string> =>
  Object.fromEntries(Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? "") : value]));

export function createRouteFactory(internalToken: string): RouteFactory {
  return (definition, handler) => async (context) => {
    try {
      const principal = definition.authentication === "user" ? requirePrincipal(context) : { accountId: "" };
      if (definition.authentication === "internal") requireInternalCaller(context, internalToken);
      const params = parseWith(definition.params, context.params);
      if (!params.ok) return params.response;
      const query = parseWith(definition.query, firstQueryValues(context.query));
      if (!query.ok) return query.response;
      const rawBody = context.request.body instanceof Uint8Array ? context.request.body : new Uint8Array();
      const body = parseWith(definition.body, definition.rawBody === true ? undefined : parseJsonBody(context.request.body));
      if (!body.ok) return body.response;
      const key = context.request.getHeader("idempotency-key")?.trim();
      if (key !== undefined && key !== "" && !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw badRequest("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 8 to 128 characters of letters, digits, - or _.");
      const sha256Header = context.request.getHeader("x-chunk-sha256")?.trim().toLowerCase();
      const result = await handler({ principal, params: params.data, query: query.data, body: body.data, rawBody, idempotencyKey: key === "" ? undefined : key, sha256Header } as never);
      const status = definition.successStatus ?? (result === undefined ? 204 : 200);
      return result === undefined || result === null ? empty(status) : json(status, result);
    } catch (error) {
      const response = errorToResponse(error);
      if (response !== undefined) return response;
      throw error;
    }
  };
}
