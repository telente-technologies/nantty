import { createRequestContext, HttpMiddlewarePipeline, createResponseContext, type HttpRequestContext, type HttpResponseContext } from "@nantty/fastify-platform";
import { createLogger, type Logger } from "@nantty/fastify-platform";
import { createPlatform, sendLegacyResponse } from "@nantty/fastify-platform";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createAdminNetworkMiddleware } from "./middlewares/adminNetwork.middleware.js";
import { createClientIpDenylistMiddleware } from "./middlewares/clientIpDenylist.middleware.js";
import { createGlobalRateLimitMiddleware } from "./middlewares/routeRateLimit.middleware.js";
import { createRequestSizeLimitMiddleware } from "./middlewares/requestSizeLimit.middleware.js";
import { createSecurityHeadersMiddleware } from "./middlewares/securityHeaders.middleware.js";
import { createStrictCorsMiddleware, isAnsweredByCorsAlone } from "./middlewares/strictCors.middleware.js";
import { InMemoryRateLimitStore, type RateLimitStore } from "./services/rateLimitStore.service.js";
import { ValkeyConnection } from "./services/valkeyConnection.service.js";
import { ValkeyRateLimitStore } from "./services/valkeyRateLimitStore.service.js";
import type { GatewayConfig } from "./configs/gateway.config.js";
import { createUpstreamDispatchHandler } from "./handlers/upstreamDispatch.handler.js";
import { IdentityStaffNetworkPolicySource, StaffNetworkGate, type StaffNetworkPolicySource } from "./services/staffNetworkPolicy.service.js";
import { IdentityPolicyGateSource, type PolicyGateSource } from "./services/policyAcceptanceGate.service.js";
import { AccessTokenVerifier, ValkeySessionRevocationSource } from "./services/accessTokenVerifier.service.js";
import { ValkeyWidgetTokenRevocationSource, WidgetTokenVerifier } from "./services/widgetTokenVerifier.service.js";
import { buildSecurityServices, type SecurityServiceOverrides } from "./services/security/securityServices.service.js";
import { attachRealtimeSocketProxy } from "./services/realtimeSocketProxy.service.js";
import { withRequestMetrics } from "./telemetry/requestMetrics.js";

const incomingRequestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

function resolveGatewayRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value.join(", ") : value;
  const requestId = candidate?.trim() ?? "";
  return incomingRequestIdPattern.test(requestId) ? requestId : crypto.randomUUID();
}

export interface GatewayServer {
  readonly address: { readonly host: string; readonly port: number; readonly family: string } | undefined;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface GatewayServerOptions {
  readonly config: GatewayConfig;
  readonly verifier?: AccessTokenVerifier;
  readonly widgetVerifier?: WidgetTokenVerifier;
  readonly logger?: Logger;
  readonly policyGate?: PolicyGateSource;
  readonly rateLimitStore?: RateLimitStore;
  readonly security?: SecurityServiceOverrides;
  readonly staffNetworkPolicy?: StaffNetworkPolicySource;
}

function buildRateLimitStore(connection: ValkeyConnection | undefined, logger: Logger): RateLimitStore {
  const memory = new InMemoryRateLimitStore();
  if (connection === undefined) return memory;
  return new ValkeyRateLimitStore(connection, (error) => logger.warn("valkey rate limit unavailable; temporarily refusing rate-limited requests", { error: error instanceof Error ? error.message : String(error) }));
}

function normalizeHeaders(request: FastifyRequest): Record<string, string> {
  return Object.fromEntries(Object.entries(request.headers).flatMap(([name, value]) => value === undefined ? [] : [[name, Array.isArray(value) ? value.join(", ") : String(value)]]));
}

function toLegacyRequest(request: FastifyRequest): HttpRequestContext {
  const url = request.raw.url ?? request.url;
  const parsed = new URL(url, "http://gateway.invalid");
  const requestId = resolveGatewayRequestId(request.headers["x-request-id"]);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
  return createRequestContext({
    id: requestId,
    method: request.method,
    url,
    path: parsed.pathname,
    headers: normalizeHeaders(request),
    body,
    remoteAddress: request.ip,
    protocol: request.protocol,
    hostname: request.hostname,
  });
}

function sendGatewayResponse(reply: FastifyReply, response: HttpResponseContext): FastifyReply {
  if (!(response.body instanceof Uint8Array)) {
    sendLegacyResponse(reply, response);
    return reply;
  }
  for (const [name, value] of Object.entries(response.headers)) {
    if (value !== undefined) reply.header(name, value);
  }
  reply.code(response.status);
  if (response.status === 204 || response.body.byteLength === 0) return reply.send();
  return reply.send(Buffer.from(response.body));
}

function setLegacyBodyLimitErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if ((error as Error & { statusCode?: number }).statusCode === 413) {
      return reply
        .header("x-content-type-options", "nosniff")
        .header("x-frame-options", "DENY")
        .header("referrer-policy", "no-referrer")
        .header("strict-transport-security", "max-age=63072000; includeSubDomains; preload")
        .header("content-security-policy", "default-src 'none'; frame-ancestors 'none'")
        .header("cross-origin-resource-policy", "same-site")
        .header("permissions-policy", "camera=(), microphone=(), geolocation=()")
        .header("x-request-id", resolveGatewayRequestId(request.headers["x-request-id"]))
        .code(413)
        .send({ error: "Payload Too Large", code: "PAYLOAD_TOO_LARGE" });
    }
    app.log.error({ err: error }, "unhandled request error");
    return reply.code(500).send({ message: "Internal Server Error", code: "INTERNAL_ERROR" });
  });
}

export function createGatewayServer(options: GatewayServerOptions): GatewayServer {
  const logger = options.logger ?? createLogger({ name: "gateway" });
  const policyGate = options.policyGate ?? (options.config.policyGate === null ? undefined : new IdentityPolicyGateSource(options.config.upstreams.identity, options.config.policyGate.internalToken));
  const connection = options.config.valkeyUrl === undefined || options.config.valkeyUrl === null ? undefined : new ValkeyConnection(new URL(options.config.valkeyUrl));
  const rateLimitStore = options.rateLimitStore ?? buildRateLimitStore(connection, logger);
  const denylistConnection = options.config.sessionDenylistUrl ? new ValkeyConnection(new URL(options.config.sessionDenylistUrl)) : connection;
  const verifier = options.verifier ?? new AccessTokenVerifier(options.config.accessToken, undefined, denylistConnection === undefined ? undefined : new ValkeySessionRevocationSource(denylistConnection));
  const widgetVerifier = options.widgetVerifier ?? new WidgetTokenVerifier(options.config.accessToken, denylistConnection === undefined ? undefined : new ValkeyWidgetTokenRevocationSource(denylistConnection));
  const security = buildSecurityServices(options.config.security, options.config.upstreams.trust, logger, connection, options.security);
  const maximumRequestBodyBytes = options.config.maxRequestBodyBytes ?? 1024 * 1024;
  const staffPolicyToken = options.config.staffNetworkPolicy?.internalToken ?? "";
  const staffNetworkGate = new StaffNetworkGate(
    options.staffNetworkPolicy ?? (staffPolicyToken === "" ? undefined : new IdentityStaffNetworkPolicySource(options.config.upstreams.identity, staffPolicyToken)),
    options.config.staffNetworkPolicy?.failClosed ?? false,
  );
  const pipeline = new HttpMiddlewarePipeline({
    middlewares: [
      createSecurityHeadersMiddleware(),
      createClientIpDenylistMiddleware(options.config.blockedClientIps ?? []),
      createGlobalRateLimitMiddleware(rateLimitStore, options.config.rateLimitMaxPerMinute, (request) => isAnsweredByCorsAlone(request, options.config.corsOrigins)),
      createStrictCorsMiddleware({
        allowedOrigins: options.config.corsOrigins,
        allowHeaders: "Authorization, Content-Type, Idempotency-Key, X-Client-Platform, X-Client-Region, X-Device-Id, X-Store-Storefront, X-Request-Id, X-Step-Up-Token, Traceparent, If-None-Match",
        exposeHeaders: "ETag, X-Request-Id, Traceparent, Retry-After, Idempotent-Replayed",
      }),
      createRequestSizeLimitMiddleware(maximumRequestBodyBytes),
      createAdminNetworkMiddleware(options.config.adminIpAllowList ?? []),
      createGlobalRateLimitMiddleware(rateLimitStore, options.config.rateLimitMaxPerMinute, (request) => !isAnsweredByCorsAlone(request, options.config.corsOrigins)),
      createUpstreamDispatchHandler({ config: options.config, verifier, widgetVerifier, logger, rateLimitStore, security, staffNetworkGate, ...(policyGate === undefined ? {} : { policyGate }), ...(connection === undefined ? {} : { cacheProbe: () => connection.command(["PING"]) }) }),
    ],
  });
  let app: FastifyInstance | undefined;
  let starting: Promise<void> | undefined;
  async function initializeAndListen(): Promise<void> {
    app = await createPlatform({
      name: "gateway",
      host: options.config.host,
      port: options.config.port,
      bodyLimit: maximumRequestBodyBytes,
      trustProxy: options.config.trustedProxyHops ?? 0,
      logger: true,
      rateLimit: false,
    });

    // The Gateway is a byte-preserving proxy. Parse bodies as buffers rather than
    // JSON so webhook signatures and arbitrary upstream payloads remain intact.
    app.removeAllContentTypeParsers();
    app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => done(null, body));
    setLegacyBodyLimitErrorHandler(app);

    const dispatch = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const legacyRequest = toLegacyRequest(request);
      const response = await withRequestMetrics(async (context) => pipeline.execute(context, createResponseContext()))(legacyRequest);
      return sendGatewayResponse(reply, response);
    };
    app.all("/", dispatch);
    app.all("/*", dispatch);

    if (options.config.realtimeUpstream) attachRealtimeSocketProxy(app.server, options.config.realtimeUpstream, logger);
    await app.listen({ host: options.config.host, port: options.config.port });
  }

  return {
    get address() {
      const address = app?.server.address();
      if (typeof address !== "object" || address === null) return undefined;
      return { host: address.address, port: address.port, family: String(address.family) };
    },
    async start() {
      starting ??= initializeAndListen();
      await starting;
    },
    async stop() {
      if (starting !== undefined) await starting;
      await app?.close();
    },
  };
}
