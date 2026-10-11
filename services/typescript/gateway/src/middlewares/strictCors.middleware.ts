import { createResponseContext, type HttpMiddleware, type HttpRequestContext } from "@zudojs/http";

export interface StrictCorsOptions {
  readonly allowedOrigins: readonly string[];
  readonly allowHeaders: string;
  readonly exposeHeaders: string;
  readonly allowMethods?: string;
  readonly maxAgeSeconds?: number;
}

export function isAnsweredByCorsAlone(request: HttpRequestContext, allowedOrigins: readonly string[]): boolean {
  const origin = request.getHeader("origin");
  const preflight = request.method === "OPTIONS" && request.getHeader("access-control-request-method") !== undefined;
  if (origin === undefined) return preflight;
  return preflight || origin === "*" || !allowedOrigins.includes(origin);
}

export function createStrictCorsMiddleware(options: StrictCorsOptions): HttpMiddleware {
  const allowed = new Set(options.allowedOrigins.filter((origin) => origin !== "*"));
  const allowMethods = options.allowMethods ?? "GET, POST, PUT, PATCH, DELETE, OPTIONS";
  return async (context, next) => {
    const origin = context.request.getHeader("origin");
    const preflight = context.request.method === "OPTIONS" && context.request.getHeader("access-control-request-method") !== undefined;
    if (origin === undefined) return preflight ? createResponseContext({ status: 400 }).json({ message: "Origin required.", code: "CORS_ORIGIN_REQUIRED" }) : next();
    if (!allowed.has(origin)) {
      return createResponseContext({ status: 403, headers: { vary: "Origin" } }).json({ message: "Origin not allowed.", code: "CORS_ORIGIN_FORBIDDEN" });
    }
    if (preflight) {
      return createResponseContext({
        status: 204,
        headers: {
          vary: "Origin",
          "access-control-allow-origin": origin,
          "access-control-allow-methods": allowMethods,
          "access-control-allow-headers": options.allowHeaders,
          "access-control-max-age": String(options.maxAgeSeconds ?? 600),
        },
      });
    }
    const response = (await next()).clone();
    response.setHeader("vary", "Origin");
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-expose-headers", options.exposeHeaders);
    return response;
  };
}
