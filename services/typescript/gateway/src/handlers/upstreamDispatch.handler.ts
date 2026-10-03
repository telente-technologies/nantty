import { createResponseContext, type HttpMiddleware } from "@zudojs/http";
import type { Logger } from "@zudojs/logger";

import type { GatewayConfig } from "../configs/gateway.config.js";
import { resolveUpstreamRouteForRequest, type UpstreamRoute } from "../routes/upstream.routes.js";
import { extractBearerTokenFromAuthorizationHeader, type AccessTokenVerifier, type VerifiedPrincipal } from "../services/accessTokenVerifier.service.js";
import { forwardRequestToUpstream } from "../services/upstreamProxy.service.js";
import { convertRequestBodyToBytes, json, unauthorizedResponseBody } from "../utils/http.util.js";

export interface UpstreamDispatchOptions {
  readonly config: GatewayConfig;
  readonly verifier: AccessTokenVerifier;
  readonly logger: Logger;
}

async function resolvePrincipalForRoute(route: UpstreamRoute, authorizationHeader: string | undefined, verifier: AccessTokenVerifier) {
  const token = extractBearerTokenFromAuthorizationHeader(authorizationHeader);
  const principal: VerifiedPrincipal | undefined = token === undefined ? undefined : await verifier.verifyAccessTokenWithJwks(token);
  return { principal, rejected: route.authentication === "required" && principal === undefined };
}

export function createUpstreamDispatchHandler(options: UpstreamDispatchOptions): HttpMiddleware {
  return async (context) => {
    const request = context.request;
    if (request.path === "/healthz") return json(200, { status: "up", service: "gateway" });
    const route = resolveUpstreamRouteForRequest(request.method, request.path);
    if (route === undefined) return json(404, { message: "Not found.", code: "NOT_FOUND" });
    const { principal, rejected } = await resolvePrincipalForRoute(route, request.getHeader("authorization"), options.verifier);
    if (rejected) return json(401, unauthorizedResponseBody);
    const requestUrl = new URL(request.url, "http://gateway.internal");
    try {
      const upstreamResponse = await forwardRequestToUpstream(options.config.upstreams[route.upstream], {
        method: request.method,
        pathWithQuery: `${requestUrl.pathname}${requestUrl.search}`,
        headers: request.headers,
        body: convertRequestBodyToBytes(request.body),
        requestId: request.id,
        clientIp: request.remoteAddress,
        principal,
      }, options.config.upstreamTimeoutMs);
      return createResponseContext({ status: upstreamResponse.status, headers: upstreamResponse.headers, body: upstreamResponse.body });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      options.logger.error("upstream request failed", { upstream: route.upstream, path: request.path, timedOut, error: error instanceof Error ? error.message : String(error) });
      return json(timedOut ? 504 : 502, { message: "The service is unavailable. Try again.", code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE" });
    }
  };
}
