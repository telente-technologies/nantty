import type { FastifyInstance } from "fastify";
import {
  createRequestContext, createRouter, sendLegacyResponse,
  type HttpRequestContext, type HttpResponseContext, type HttpRouter, type HttpRouterContext,
} from "@nantty/fastify-platform";

export type SocialRouteHandler = (context: HttpRouterContext) => Promise<HttpResponseContext> | HttpResponseContext;
export type SocialHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export interface SocialHttpRouter extends HttpRouter {
  setFastifyHandler(handler: (request: HttpRequestContext) => Promise<HttpResponseContext>): void;
}

export function createSocialRouter(app?: FastifyInstance): SocialHttpRouter {
  const router = createRouter();
  const matched = new WeakMap<HttpRequestContext, { handler: SocialRouteHandler; path: string; params: Record<string, string> }>();
  const dispatch: HttpRouter["dispatch"] = async (request, options = {}) => {
    const route = matched.get(request);
    if (route === undefined) return router.dispatch(request, options);
    const query = Object.fromEntries(Object.entries(request.query).filter((entry): entry is [string, string | string[]] => entry[1] !== undefined));
    return {
      response: await route.handler({ request, params: route.params, query, route: { path: route.path }, signal: options.signal ?? request.signal, state: new Map() }),
      route: { path: route.path },
    };
  };
  let fastifyHandler: ((request: HttpRequestContext) => Promise<HttpResponseContext>) | undefined;
  const register = (method: SocialHttpMethod, path: string, handler: SocialRouteHandler): void => {
    router[method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete"](path, handler);
    app?.route({ method, url: path, handler: async (request, reply) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      request.raw.once("aborted", abort);
      try {
        const context = createRequestContext({
          id: request.id, method: request.method, url: request.url,
          headers: Object.fromEntries(Object.entries(request.headers).flatMap(([name, value]) => value === undefined ? [] : [[name, Array.isArray(value) ? value.join(", ") : String(value)]])),
          body: request.body, remoteAddress: request.ip, protocol: request.protocol, hostname: request.hostname, signal: controller.signal,
        });
        matched.set(context, { handler, path, params: request.params as Record<string, string> });
        const response = fastifyHandler === undefined ? (await dispatch(context)).response : await fastifyHandler(context);
        sendLegacyResponse(reply, response);
      } finally { request.raw.off("aborted", abort); }
    } });
  };
  return {
    get: (path, handler) => register("GET", path, handler), post: (path, handler) => register("POST", path, handler),
    put: (path, handler) => register("PUT", path, handler), patch: (path, handler) => register("PATCH", path, handler),
    delete: (path, handler) => register("DELETE", path, handler), dispatch,
    setFastifyHandler: (handler) => { fastifyHandler = handler; },
  };
}
