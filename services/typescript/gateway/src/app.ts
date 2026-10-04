import {
  HttpMiddlewarePipeline,
  createHttpServer,
  createNodeHttpAdapter,
  createResponseContext,
  type HttpRequestContext,
} from "@zudojs/http";
import { createLogger, type Logger } from "@zudojs/logger";

import { createGlobalRateLimitMiddleware } from "./middlewares/routeRateLimit.middleware.js";
import { createRequestSizeLimitMiddleware } from "./middlewares/requestSizeLimit.middleware.js";
import { createSecurityHeadersMiddleware } from "./middlewares/securityHeaders.middleware.js";
import { createStrictCorsMiddleware } from "./middlewares/strictCors.middleware.js";
import { InMemoryRateLimitStore, type RateLimitStore } from "./services/rateLimitStore.service.js";
import { ValkeyConnection } from "./services/valkeyConnection.service.js";
import { ValkeyRateLimitStore } from "./services/valkeyRateLimitStore.service.js";
import type { GatewayConfig } from "./configs/gateway.config.js";
import { createUpstreamDispatchHandler } from "./handlers/upstreamDispatch.handler.js";
import { IdentityPolicyGateSource, type PolicyGateSource } from "./services/policyAcceptanceGate.service.js";
import { AccessTokenVerifier } from "./services/accessTokenVerifier.service.js";
import { buildSecurityServices, type SecurityServiceOverrides } from "./services/security/securityServices.service.js";

export interface GatewayServerOptions {
  readonly config: GatewayConfig;
  readonly verifier?: AccessTokenVerifier;
  readonly logger?: Logger;
  readonly policyGate?: PolicyGateSource;
  readonly rateLimitStore?: RateLimitStore;
  readonly security?: SecurityServiceOverrides;
}

function buildRateLimitStore(connection: ValkeyConnection | undefined, logger: Logger): RateLimitStore {
  const memory = new InMemoryRateLimitStore();
  if (connection === undefined) return memory;
  return new ValkeyRateLimitStore(connection, memory, (error) => logger.warn("valkey rate limit unavailable; using in-memory counters", { error: error instanceof Error ? error.message : String(error) }));
}

export function createGatewayServer(options: GatewayServerOptions) {
  const logger = options.logger ?? createLogger({ name: "gateway" });
  const policyGate = options.policyGate ?? (options.config.policyGate === null ? undefined : new IdentityPolicyGateSource(options.config.upstreams.identity, options.config.policyGate.internalToken));
  const verifier = options.verifier ?? new AccessTokenVerifier(options.config.accessToken);
  const connection = options.config.valkeyUrl === undefined || options.config.valkeyUrl === null ? undefined : new ValkeyConnection(new URL(options.config.valkeyUrl));
  const rateLimitStore = options.rateLimitStore ?? buildRateLimitStore(connection, logger);
  const security = buildSecurityServices(options.config.security, options.config.upstreams.trust, logger, connection, options.security);
  const maximumRequestBodyBytes = options.config.maxRequestBodyBytes ?? 1024 * 1024;
  const pipeline = new HttpMiddlewarePipeline({
    middlewares: [
      createSecurityHeadersMiddleware(),
      createStrictCorsMiddleware({
        allowedOrigins: options.config.corsOrigins,
        allowHeaders: "Authorization, Content-Type, Idempotency-Key, X-Client-Platform, X-Client-Region, X-Device-Id, X-Store-Storefront, X-Request-Id, X-Step-Up-Token, Traceparent, If-None-Match",
        exposeHeaders: "ETag, X-Request-Id, Traceparent, Retry-After, Idempotent-Replayed",
      }),
      createRequestSizeLimitMiddleware(maximumRequestBodyBytes),
      createGlobalRateLimitMiddleware(rateLimitStore, options.config.rateLimitMaxPerMinute),
      createUpstreamDispatchHandler({ config: options.config, verifier, logger, rateLimitStore, security, ...(policyGate === undefined ? {} : { policyGate }) }),
    ],
  });
  return createHttpServer({
    adapter: createNodeHttpAdapter({ host: options.config.host, port: options.config.port, maxBodySize: maximumRequestBodyBytes, trustProxy: true }),
    handler: (request: HttpRequestContext) => pipeline.execute(request, createResponseContext()),
  });
}
