import { createResponseContext, type HttpMiddleware } from "@zudojs/http";
import type { Logger } from "@zudojs/logger";

import type { GatewayConfig } from "../configs/gateway.config.js";
import { isChatReportSubmission, resolveUpstreamRouteForRequest, sensitiveGuestPathPrefixes, type UpstreamRoute } from "../routes/upstream.routes.js";
import { doesRequestNeedPolicyGate, type PolicyGateSource } from "../services/policyAcceptanceGate.service.js";
import { isInternalOnlyPath } from "../services/internalRouteGuard.service.js";
import { InMemoryRateLimitStore, type RateLimitStore } from "../services/rateLimitStore.service.js";
import { buildRouteRateLimitKey, classifyRequestForRateLimit, defaultRouteLimitsPerMinute } from "../services/routeRateLimitPolicy.service.js";
import { startGatewaySpan } from "../services/traceContext.service.js";
import { extractBearerTokenFromAuthorizationHeader, type AccessTokenVerifier, type VerifiedPrincipal } from "../services/accessTokenVerifier.service.js";
import { forwardRequestToUpstream } from "../services/upstreamProxy.service.js";
import { convertRequestBodyToBytes, json, unauthorizedResponseBody } from "../utils/http.util.js";

export interface UpstreamDispatchOptions {
  readonly config: GatewayConfig;
  readonly verifier: AccessTokenVerifier;
  readonly logger: Logger;
  readonly policyGate?: PolicyGateSource;
  readonly rateLimitStore?: RateLimitStore;
}

function buildRateLimited(retryAfterSeconds: number) {
  const limited = json(429, { message: "Too many requests. Try again shortly.", code: "RATE_LIMITED" }).clone();
  limited.setHeader("retry-after", String(retryAfterSeconds));
  return limited;
}

async function resolvePrincipalForRoute(route: UpstreamRoute, authorizationHeader: string | undefined, verifier: AccessTokenVerifier) {
  const token = extractBearerTokenFromAuthorizationHeader(authorizationHeader);
  const principal: VerifiedPrincipal | undefined = token === undefined ? undefined : await verifier.verifyAccessTokenWithJwks(token);
  return { principal, rejected: route.authentication === "required" && principal === undefined };
}

export function createUpstreamDispatchHandler(options: UpstreamDispatchOptions): HttpMiddleware {
  const rateLimitStore = options.rateLimitStore ?? new InMemoryRateLimitStore();
  return async (context) => {
    const request = context.request;
    if (request.path === "/healthz") return json(200, { status: "up", service: "gateway" });
    if (isInternalOnlyPath(request.path)) return json(404, { message: "Not found.", code: "NOT_FOUND" });
    const route = resolveUpstreamRouteForRequest(request.method, request.path);
    if (route === undefined) return json(404, { message: "Not found.", code: "NOT_FOUND" });
    const { principal, rejected } = await resolvePrincipalForRoute(route, request.getHeader("authorization"), options.verifier);
    if (rejected) return json(401, unauthorizedResponseBody);
    const requestUrl = new URL(request.url, "http://gateway.internal");
    if (principal !== undefined && options.policyGate !== undefined && doesRequestNeedPolicyGate(request.method, requestUrl.pathname)) {
      try {
        const gate = await options.policyGate.readGate(principal.accountId);
        if (gate.acceptanceRequired) return json(428, { message: "Accept the updated policies to continue.", code: "POLICY_ACCEPTANCE_REQUIRED", documentKeys: gate.documentKeys });
      } catch (error) {
        options.logger.warn("policy gate lookup failed; letting the request through", { error: error instanceof Error ? error.message : String(error) });
      }
    }
    const routeLimit = classifyRequestForRateLimit(request.method, requestUrl.pathname);
    if (routeLimit !== undefined) {
      const limit = options.config.routeRateLimitsPerMinute?.[routeLimit] ?? defaultRouteLimitsPerMinute[routeLimit];
      const decision = await rateLimitStore.hit(buildRouteRateLimitKey(routeLimit, request.remoteAddress, principal?.accountId), limit, 60);
      if (!decision.allowed) return buildRateLimited(decision.retryAfterSeconds);
    }
    if (principal === undefined && route.rawBodyPassthrough !== true) {
      const sensitive = sensitiveGuestPathPrefixes.some((prefix) => requestUrl.pathname.startsWith(prefix));
      const limits = options.config.guestRateLimits;
      const deviceId = request.getHeader("x-device-id") ?? request.getHeader("x-client-region") ?? "";
      const decision = await rateLimitStore.hit(`rl:guest:${sensitive ? "s" : "g"}|${request.remoteAddress ?? ""}|${deviceId}`, sensitive ? limits.sensitivePerMinute : limits.perMinute, 60);
      if (!decision.allowed) return buildRateLimited(decision.retryAfterSeconds);
    }
    const trace = startGatewaySpan(request.getHeader("traceparent"));
    const requestBody = convertRequestBodyToBytes(request.body);
    const upstreamName = route.upstream === "social" && isChatReportSubmission(request.method, requestUrl.pathname, requestBody) ? "trust" : route.upstream;
    try {
      const upstreamResponse = await forwardRequestToUpstream(options.config.upstreams[upstreamName], {
        method: request.method,
        pathWithQuery: `${requestUrl.pathname}${requestUrl.search}`,
        headers: request.headers,
        body: requestBody,
        requestId: request.id,
        clientIp: request.remoteAddress,
        principal,
        traceparent: trace.traceparent,
        forwardWebhookSignatureHeaders: route.rawBodyPassthrough === true,
      }, options.config.upstreamTimeoutMs);
      return createResponseContext({ status: upstreamResponse.status, headers: { ...upstreamResponse.headers, traceparent: trace.traceparent }, body: upstreamResponse.body });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      options.logger.error("upstream request failed", { upstream: upstreamName, path: request.path, timedOut, error: error instanceof Error ? error.message : String(error) });
      return json(timedOut ? 504 : 502, { message: "The service is unavailable. Try again.", code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE" });
    }
  };
}
