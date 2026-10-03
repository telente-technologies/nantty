import {
  HttpMiddlewarePipeline,
  createCorsMiddleware,
  createHttpServer,
  createNodeHttpAdapter,
  createRateLimitMiddleware,
  createResponseContext,
  type HttpMiddleware,
  type HttpRequestContext,
} from "@zudojs/http";
import { createLogger, type Logger } from "@zudojs/logger";

import type { GatewayConfig } from "./configs/gateway.config.js";
import { createUpstreamDispatchHandler } from "./handlers/upstreamDispatch.handler.js";
import { AccessTokenVerifier } from "./services/accessTokenVerifier.service.js";

const maximumRequestBodyBytes = 1024 * 1024;

function addSecurityAndRequestIdHeaders(): HttpMiddleware {
  return async (context, next) => {
    const response = (await next()).clone();
    response.setHeader("x-request-id", context.request.id);
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("strict-transport-security", "max-age=63072000; includeSubDomains");
    return response;
  };
}

export interface GatewayServerOptions {
  readonly config: GatewayConfig;
  readonly verifier?: AccessTokenVerifier;
  readonly logger?: Logger;
}

export function createGatewayServer(options: GatewayServerOptions) {
  const logger = options.logger ?? createLogger({ name: "gateway" });
  const verifier = options.verifier ?? new AccessTokenVerifier(options.config.accessToken);
  const pipeline = new HttpMiddlewarePipeline({
    middlewares: [
      addSecurityAndRequestIdHeaders(),
      createCorsMiddleware({
        allowOrigin: [...options.config.corsOrigins],
        allowHeaders: "Authorization, Content-Type, Idempotency-Key, X-Client-Region, X-Request-Id, If-None-Match",
        exposeHeaders: "ETag, X-Request-Id, Retry-After, Idempotent-Replayed",
        credentials: false,
      }),
      ...(options.config.rateLimitMaxPerMinute > 0 ? [createRateLimitMiddleware({ windowMs: 60_000, max: options.config.rateLimitMaxPerMinute })] : []),
      createUpstreamDispatchHandler({ config: options.config, verifier, logger }),
    ],
  });
  return createHttpServer({
    adapter: createNodeHttpAdapter({ host: options.config.host, port: options.config.port, maxBodySize: maximumRequestBodyBytes, trustProxy: true }),
    handler: (request: HttpRequestContext) => pipeline.execute(request, createResponseContext()),
  });
}
