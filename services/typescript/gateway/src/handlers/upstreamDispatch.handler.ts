import { createResponseContext, type HttpMiddleware } from "@nantty/fastify-platform";
import type { Logger } from "@nantty/fastify-platform";

import type { GatewayConfig } from "../configs/gateway.config.js";
import { isChatReportSubmission, resolveUpstreamRouteForRequest, sensitiveGuestPathPrefixes, type UpstreamRoute } from "../routes/upstream.routes.js";
import { shouldRefuseAnonymousMutation } from "../services/anonymousMutationGuard.service.js";
import { authenticateStaffRequest, doesAdminRequestNeedStaffToken } from "../services/adminStaffGate.service.js";
import { shouldRefuseSuspendedPrincipal } from "../services/suspendedAccountGuard.service.js";
import type { StaffNetworkGate } from "../services/staffNetworkPolicy.service.js";
import { doesRequestNeedPolicyGate, type PolicyGateSource } from "../services/policyAcceptanceGate.service.js";
import { isInternalOnlyPath } from "../services/internalRouteGuard.service.js";
import { InMemoryRateLimitStore, type RateLimitStore } from "../services/rateLimitStore.service.js";
import { buildRouteRateLimitBuckets, classifyRequestForRateLimit, defaultRouteLimitWindowsSeconds, defaultRouteLimitsPerMinute } from "../services/routeRateLimitPolicy.service.js";
import { startGatewaySpan } from "../services/traceContext.service.js";
import { extractBearerTokenFromAuthorizationHeader, type AccessTokenVerifier, type VerifiedPrincipal } from "../services/accessTokenVerifier.service.js";
import { forwardRequestToUpstream } from "../services/upstreamProxy.service.js";
import type { WidgetTokenVerifier } from "../services/widgetTokenVerifier.service.js";
import { convertRequestBodyToBytes, json, unauthorizedResponseBody } from "../utils/http.util.js";
import { runReadinessChecks } from "../utils/readiness.util.js";
import { buildSecurityServices, type SecurityServices } from "../services/security/securityServices.service.js";
import { humanVerificationPath, humanVerificationRequiredBody, rateLimitChallengeCooldownKey, rateLimitChallengePassKey, rateLimitChallengePendingKey } from "../services/security/humanVerificationGate.service.js";
import { handleHumanVerificationRequest } from "./humanVerification.handler.js";
import { completedRequestSignal, internalPathSignal, observeProbeSignalInBackground, tamperedTokenSignal, type ObservedRequest } from "./securityObservation.handler.js";
import { markRequestRoute } from "../telemetry/requestMetrics.js";
import { isAdminPath, truncateIpToPrefix } from "../services/security/accessProbeClassifier.service.js";

export interface UpstreamDispatchOptions {
  readonly config: GatewayConfig;
  readonly verifier: AccessTokenVerifier;
  readonly widgetVerifier?: WidgetTokenVerifier;
  readonly logger: Logger;
  readonly policyGate?: PolicyGateSource;
  readonly rateLimitStore?: RateLimitStore;
  readonly security?: SecurityServices;
  readonly cacheProbe?: () => Promise<unknown>;
  readonly staffNetworkGate?: StaffNetworkGate;
}

async function readinessResponse(cacheProbe: (() => Promise<unknown>) | undefined) {
  if (cacheProbe === undefined) return json(200, { status: "ready" });
  const { ready } = await runReadinessChecks({ cache: cacheProbe }, 500);
  return json(200, ready ? { status: "ready" } : { status: "ready", cache: "degraded" });
}

function buildRateLimited(retryAfterSeconds: number) {
  const limited = json(429, { message: "Too many requests. Try again shortly.", code: "RATE_LIMITED" }).clone();
  limited.setHeader("retry-after", String(retryAfterSeconds));
  return limited;
}

const rateLimitChallengeThreshold = 3;
const rateLimitChallengeWindowSeconds = 300;

function rateLimitSubject(principal: VerifiedPrincipal | undefined, remoteAddress: string | undefined): string {
  return principal === undefined ? `i:${truncateIpToPrefix(remoteAddress) ?? "unknown"}` : `s:${principal.sessionId}`;
}

async function respondToRateLimit(request: Parameters<HttpMiddleware>[0]["request"], principal: VerifiedPrincipal | undefined, retryAfterSeconds: number, security: SecurityServices) {
  const limited = buildRateLimited(retryAfterSeconds);
  if (security.gate === undefined || security.provider === undefined) return limited;
  const subject = rateLimitSubject(principal, request.remoteAddress);
  if (await security.store.take(rateLimitChallengePassKey(subject))) return undefined;
  if (await security.store.has(rateLimitChallengeCooldownKey(subject))) return limited;
  const strikes = await security.store.recordInWindow(`sec:hv:rate-limit-strikes:${subject}`, request.id, rateLimitChallengeWindowSeconds);
  if (strikes < rateLimitChallengeThreshold) return limited;
  await security.store.put(rateLimitChallengePendingKey(subject), rateLimitChallengeWindowSeconds);
  return json(428, humanVerificationRequiredBody("rate_limit_abuse", security.provider.name));
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
    if (request.path === "/healthz" || request.path === "/readyz" || request.path === humanVerificationPath) markRequestRoute(request, request.path);
    if (request.path === "/healthz") return json(200, { status: "up", service: "gateway" });
    if (request.path === "/readyz") return readinessResponse(options.cacheProbe);
    if (request.url.startsWith("//") || request.path.includes("//")) {
      return json(404, { message: "Not found.", code: "NOT_FOUND" });
    }
    const observed = (principal: VerifiedPrincipal | undefined): ObservedRequest => ({ requestId: request.id, path: request.path, deviceId: request.getHeader("x-device-id"), clientIp: request.remoteAddress, principal });
    if (isInternalOnlyPath(request.path)) {
      observeProbeSignalInBackground(security, options.logger, observed(undefined), internalPathSignal(request.path));
      return json(404, { message: "Not found.", code: "NOT_FOUND" });
    }
    if (request.method.toUpperCase() === "OPTIONS" && isAdminPath(request.path)) return createResponseContext({ status: 204 });
    if (request.path === humanVerificationPath) return handleHumanVerificationRequest(request, security, options.verifier, rateLimitStore, options.logger);
    const route = resolveUpstreamRouteForRequest(request.method, request.path);
    if (route === undefined) return json(404, { message: "Not found.", code: "NOT_FOUND" });
    markRequestRoute(request, route.pathPrefix);
    const { token, principal, rejected, widgetTokenMisused } = await resolvePrincipalForRoute(route, request.getHeader("authorization"), options.verifier, options.widgetVerifier);
    if (widgetTokenMisused) return json(401, { message: "This token only works for home-screen widgets.", code: "WIDGET_TOKEN_SCOPE" });
    observeProbeSignalInBackground(security, options.logger, observed(principal), tamperedTokenSignal(request.path, token, principal, options.config.accessToken.audience));
    if (rejected) return json(401, unauthorizedResponseBody);
    if (security.gate !== undefined && security.provider !== undefined) {
      const subject = rateLimitSubject(principal, request.remoteAddress);
      if (await security.store.has(rateLimitChallengePendingKey(subject))) return json(428, humanVerificationRequiredBody("rate_limit_abuse", security.provider.name));
    }
    if (doesAdminRequestNeedStaffToken(request.method, request.path)) {
      const staff = await authenticateStaffRequest(options.verifier, request.getHeader("authorization"));
      if (staff === undefined) return json(401, unauthorizedResponseBody);
      const refusal = await options.staffNetworkGate?.refuse(staff.accountId, request.remoteAddress);
      if (refusal !== undefined) return json(refusal.status, refusal.body);
    }
    if (principal === undefined && shouldRefuseAnonymousMutation(request.method, request.path, request.getHeader("authorization"))) return json(401, unauthorizedResponseBody);
    const requestUrl = new URL(request.url, "http://gateway.internal");
    if (shouldRefuseSuspendedPrincipal(principal, request.method, requestUrl.pathname)) {
      return json(403, { message: "This account has been suspended.", code: "ACCOUNT_SUSPENDED" });
    }
    if (principal !== undefined) {
      const decision = await rateLimitStore.hit(`rl:authenticated-api:a:${principal.accountId}`, options.config.authenticatedApiLimitPerMinute ?? 120, 60);
      if (!decision.allowed) {
        const response = await respondToRateLimit(request, principal, decision.retryAfterSeconds, security);
        if (response !== undefined) return response;
      }
    }
    if (principal !== undefined && options.policyGate !== undefined && doesRequestNeedPolicyGate(request.method, requestUrl.pathname)) {
      try {
        const gate = await options.policyGate.readGate(principal.accountId);
        if (gate.acceptanceRequired) return json(428, { message: "Accept the updated policies to continue.", code: "POLICY_ACCEPTANCE_REQUIRED", documentKeys: gate.documentKeys });
      } catch (error) {
        options.logger.warn("policy gate lookup failed; refusing the request", { error: error instanceof Error ? error.message : String(error) });
        return json(503, { message: "Policy verification is temporarily unavailable. Try again shortly.", code: "POLICY_GATE_UNAVAILABLE" });
      }
    }
    if (principal !== undefined && security.gate !== undefined) {
      try {
        const gate = await security.gate.evaluate({ method: request.method, path: requestUrl.pathname, accountId: principal.accountId, sessionId: principal.sessionId });
        if (gate.challenge) return json(428, humanVerificationRequiredBody(gate.reason ?? "security_check", security.provider?.name ?? "turnstile"));
      } catch (error) {
        options.logger.warn("human verification gate lookup failed; refusing the request", { error: error instanceof Error ? error.message : String(error) });
        return json(503, { message: "Security verification is temporarily unavailable. Try again shortly.", code: "SECURITY_CHECK_UNAVAILABLE" });
      }
    }
    const routeLimit = classifyRequestForRateLimit(request.method, requestUrl.pathname);
    if (routeLimit !== undefined) {
      const buckets = buildRouteRateLimitBuckets(routeLimit, request.remoteAddress, principal?.accountId, request.body, options.config.identitySigningSecret ?? "");
      for (const bucket of buckets) {
        const limit = options.config.routeRateLimitsPerMinute?.[bucket.name] ?? defaultRouteLimitsPerMinute[bucket.name];
        const windowSeconds = options.config.routeRateLimitWindowsSeconds?.[bucket.name] ?? defaultRouteLimitWindowsSeconds[bucket.name];
        const decision = await rateLimitStore.hit(bucket.key, limit, windowSeconds);
        if (!decision.allowed) {
          const response = await respondToRateLimit(request, principal, decision.retryAfterSeconds, security);
          if (response !== undefined) return response;
        }
      }
    }
    if (principal === undefined && route.rawBodyPassthrough !== true) {
      const sensitive = sensitiveGuestPathPrefixes.some((prefix) => requestUrl.pathname.startsWith(prefix));
      const limits = options.config.guestRateLimits;
      const decision = await rateLimitStore.hit(`rl:guest:${sensitive ? "s" : "g"}|${request.remoteAddress ?? ""}`, sensitive ? limits.sensitivePerMinute : limits.perMinute, 60);
      if (!decision.allowed) {
        const response = await respondToRateLimit(request, principal, decision.retryAfterSeconds, security);
        if (response !== undefined) return response;
      }
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
