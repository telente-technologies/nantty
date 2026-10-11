import { createResponseContext, type HttpMiddleware } from "@zudojs/http";
import type { Logger } from "@zudojs/logger";

import type { GatewayConfig } from "../configs/gateway.config.js";
import { isChatReportSubmission, resolveUpstreamRouteForRequest, sensitiveGuestPathPrefixes, type UpstreamRoute } from "../routes/upstream.routes.js";
import { shouldRefuseAnonymousMutation } from "../services/anonymousMutationGuard.service.js";
import { doesAdminRequestNeedStaffToken, isStaffRequestAuthenticated } from "../services/adminStaffGate.service.js";
import { doesRequestNeedPolicyGate, type PolicyGateSource } from "../services/policyAcceptanceGate.service.js";
import { isInternalOnlyPath } from "../services/internalRouteGuard.service.js";
import { InMemoryRateLimitStore, type RateLimitStore } from "../services/rateLimitStore.service.js";
import { buildRouteRateLimitKey, classifyRequestForRateLimit, defaultRouteLimitsPerMinute } from "../services/routeRateLimitPolicy.service.js";
import { startGatewaySpan } from "../services/traceContext.service.js";
import { extractBearerTokenFromAuthorizationHeader, type AccessTokenVerifier, type VerifiedPrincipal } from "../services/accessTokenVerifier.service.js";
import { forwardRequestToUpstream } from "../services/upstreamProxy.service.js";
import type { WidgetTokenVerifier } from "../services/widgetTokenVerifier.service.js";
import { convertRequestBodyToBytes, json, unauthorizedResponseBody } from "../utils/http.util.js";
import { buildSecurityServices, type SecurityServices } from "../services/security/securityServices.service.js";
import { humanVerificationPath, humanVerificationRequiredBody } from "../services/security/humanVerificationGate.service.js";
import { handleHumanVerificationRequest } from "./humanVerification.handler.js";
import { completedRequestSignal, internalPathSignal, observeProbeSignalInBackground, tamperedTokenSignal, type ObservedRequest } from "./securityObservation.handler.js";

export interface UpstreamDispatchOptions {
  readonly config: GatewayConfig;
  readonly verifier: AccessTokenVerifier;
  readonly widgetVerifier?: WidgetTokenVerifier;
  readonly logger: Logger;
  readonly policyGate?: PolicyGateSource;
  readonly rateLimitStore?: RateLimitStore;
  readonly security?: SecurityServices;
}

function buildRateLimited(retryAfterSeconds: number) {
  const limited = json(429, { message: "Too many requests. Try again shortly.", code: "RATE_LIMITED" }).clone();
  limited.setHeader("retry-after", String(retryAfterSeconds));
  return limited;
}

async function resolvePrincipalForRoute(route: UpstreamRoute, authorizationHeader: string | undefined, verifier: AccessTokenVerifier, widgetVerifier: WidgetTokenVerifier | undefined) {
  const token = extractBearerTokenFromAuthorizationHeader(authorizationHeader);
  const sessionPrincipal: VerifiedPrincipal | undefined = token === undefined ? undefined : await verifier.verifyAccessTokenWithJwks(token);
  const widgetPrincipal = token === undefined || sessionPrincipal !== undefined || widgetVerifier === undefined ? undefined : await widgetVerifier.verifyWidgetToken(token);
  if (widgetPrincipal !== undefined && route.acceptsWidgetToken !== true) return { token, principal: undefined, rejected: true, widgetTokenMisused: true };
  const principal = sessionPrincipal ?? widgetPrincipal;
  return { token, principal, rejected: route.authentication === "required" && principal === undefined, widgetTokenMisused: false };
}

export function createUpstreamDispatchHandler(options: UpstreamDispatchOptions): HttpMiddleware {
  const rateLimitStore = options.rateLimitStore ?? new InMemoryRateLimitStore();
  const security = options.security ?? buildSecurityServices(options.config.security, options.config.upstreams.trust, options.logger, undefined);
  return async (context) => {
    const request = context.request;
    if (request.path === "/healthz") return json(200, { status: "up", service: "gateway" });
    const observed = (principal: VerifiedPrincipal | undefined): ObservedRequest => ({ requestId: request.id, path: request.path, deviceId: request.getHeader("x-device-id"), clientIp: request.remoteAddress, principal });
    if (isInternalOnlyPath(request.path)) {
      observeProbeSignalInBackground(security, options.logger, observed(undefined), internalPathSignal(request.path));
      return json(404, { message: "Not found.", code: "NOT_FOUND" });
    }
    if (request.path === humanVerificationPath) return handleHumanVerificationRequest(request, security, options.verifier, rateLimitStore, options.logger);
    const route = resolveUpstreamRouteForRequest(request.method, request.path);
    if (route === undefined) return json(404, { message: "Not found.", code: "NOT_FOUND" });
    const { token, principal, rejected, widgetTokenMisused } = await resolvePrincipalForRoute(route, request.getHeader("authorization"), options.verifier, options.widgetVerifier);
    if (widgetTokenMisused) return json(401, { message: "This token only works for home-screen widgets.", code: "WIDGET_TOKEN_SCOPE" });
    observeProbeSignalInBackground(security, options.logger, observed(principal), tamperedTokenSignal(request.path, token, principal, options.config.accessToken.audience));
    if (rejected) return json(401, unauthorizedResponseBody);
    if (doesAdminRequestNeedStaffToken(request.method, request.path) && !(await isStaffRequestAuthenticated(options.verifier, request.getHeader("authorization")))) return json(401, unauthorizedResponseBody);
    if (principal === undefined && shouldRefuseAnonymousMutation(request.method, request.path, request.getHeader("authorization"))) return json(401, unauthorizedResponseBody);
    const requestUrl = new URL(request.url, "http://gateway.internal");
    if (principal !== undefined && options.policyGate !== undefined && doesRequestNeedPolicyGate(request.method, requestUrl.pathname)) {
      try {
        const gate = await options.policyGate.readGate(principal.accountId);
        if (gate.acceptanceRequired) return json(428, { message: "Accept the updated policies to continue.", code: "POLICY_ACCEPTANCE_REQUIRED", documentKeys: gate.documentKeys });
      } catch (error) {
        options.logger.warn("policy gate lookup failed; letting the request through", { error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (principal !== undefined && security.gate !== undefined) {
      try {
        const gate = await security.gate.evaluate({ method: request.method, path: requestUrl.pathname, accountId: principal.accountId, sessionId: principal.sessionId });
        if (gate.challenge) return json(428, humanVerificationRequiredBody(gate.reason ?? "security_check", security.provider?.name ?? "turnstile"));
      } catch (error) {
        options.logger.warn("human verification gate lookup failed; letting the request through", { error: error instanceof Error ? error.message : String(error) });
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
      const decision = await rateLimitStore.hit(`rl:guest:${sensitive ? "s" : "g"}|${request.remoteAddress ?? ""}`, sensitive ? limits.sensitivePerMinute : limits.perMinute, 60);
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
        allowRedirect: route.redirectPassthrough === true,
        trustCdnCountryHeader: options.config.trustCdnCountryHeader === true,
      }, options.config.upstreamTimeoutMs, options.config.identitySigningSecret);
      observeProbeSignalInBackground(security, options.logger, observed(principal), completedRequestSignal(requestUrl.pathname, upstreamResponse.status, principal, upstreamResponse.body));
      return createResponseContext({ status: upstreamResponse.status, headers: { ...upstreamResponse.headers, traceparent: trace.traceparent }, body: upstreamResponse.body });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      options.logger.error("upstream request failed", { upstream: upstreamName, path: request.path, timedOut, error: error instanceof Error ? error.message : String(error) });
      return json(timedOut ? 504 : 502, { message: "The service is unavailable. Try again.", code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE" });
    }
  };
}
