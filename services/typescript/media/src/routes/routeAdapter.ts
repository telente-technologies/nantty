import { createRequestContext, sendLegacyResponse, type HttpResponseContext, type HttpRouterContext } from "@nantty/fastify-platform";
import type { FastifyReply, FastifyRequest } from "fastify";

export type LegacyRouteHandler = (context: HttpRouterContext) => Promise<HttpResponseContext>;

function headersFor(request: FastifyRequest): Record<string, string> {
  return Object.fromEntries(Object.entries(request.headers).flatMap(([name, value]) => value === undefined ? [] : [[name, Array.isArray(value) ? value.join(",") : String(value)]]));
}

function queryFor(request: FastifyRequest): Record<string, string | string[]> {
  const parsed = new URL(request.url, "http://nantty.invalid");
  return Object.fromEntries(Array.from(new Set(parsed.searchParams.keys())).map((key) => {
    const values = parsed.searchParams.getAll(key);
    return [key, values.length > 1 ? values : values[0] ?? ""];
  }));
}

export function createLegacyRouteContext(request: FastifyRequest, signal?: AbortSignal): HttpRouterContext {
  const parsed = new URL(request.url, "http://nantty.invalid");
  const query = queryFor(request);
  const params = (request.params ?? {}) as Record<string, string>;
  const context = createRequestContext({
    id: request.id,
    method: request.method,
    url: request.url,
    path: parsed.pathname,
    headers: headersFor(request),
    query,
    params,
    body: request.body,
    remoteAddress: request.ip,
    protocol: request.protocol,
    hostname: request.hostname,
    signal,
  });
  return { request: context, params, query, route: { path: request.routeOptions.url }, signal, state: new Map() };
}

export async function invokeLegacyRoute(reply: FastifyReply, request: FastifyRequest, handler: LegacyRouteHandler): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.raw.once("aborted", abort);
  const context = createLegacyRouteContext(request, controller.signal);
  try { sendLegacyResponse(reply, await handler(context)); }
  finally { request.raw.off("aborted", abort); }
}
