import type { HttpMiddleware } from "@nantty/fastify-platform";

export function createSecurityHeadersMiddleware(): HttpMiddleware {
  return async (context, next) => {
    const response = (await next()).clone();
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
    response.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
    response.setHeader("cross-origin-resource-policy", "same-site");
    response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("x-request-id", context.request.id);
    return response;
  };
}
