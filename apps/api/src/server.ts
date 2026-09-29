import { createServer } from "node:http";

import {
  HttpMiddlewarePipeline,
  createCorsMiddleware,
  createHttpServer,
  createNodeHttpAdapter,
  createRateLimitMiddleware,
  createResponseContext,
  createRouter,
  type HttpMiddleware,
  type HttpRequestContext,
} from "@zudojs/http";
// zudojs:server-imports:start
import { mountOpenAPI } from "@zudojs/http";
// zudojs:server-imports:end

import { createApp } from "./app.js";
import { loadConfig } from "./configs/index.js";
import { APP_DEPENDENCIES, createDependencies } from "./container.js";
import { checkIntegrations, drainIntegrations, integrations } from "./integrations/index.js";
import { schedules } from "./integrations/scheduler.integration.js";
import { registerScheduledJobs } from "./jobs/scheduledJobs.job.js";
import { DEFAULT_REQUEST_BODY_LIMIT_BYTES, limitRequestBodySize } from "./middlewares/requestBodyLimit.middleware.js";
import { addRequestIdResponseHeader } from "./middlewares/requestId.middleware.js";
import { registerRoutes } from "./routes/index.js";
import { createApplicationRouterOptions, errorDetails, errorResponse, json, securityHeaders } from "./utils/http.util.js";

const config = await loadConfig();
const httpServer = createServer();
// The Node adapter buffers bodies before routing with one global limit, so it admits one chunk and
// limitRequestBodySize keeps every other route at 1 MiB.
const chunkUploadBodyLimitBytes = config.media.chunkSizeBytes + 64 * 1024;
const runtime = createApp({ config, httpServer });
const logger = runtime.context.logger;

const dependencies = createDependencies({
  settings: config,
  logger,
  health: async () => {
    const checks = await checkIntegrations(integrations);
    const ready =
      runtime.state === "running" && Object.values(checks).every((check) => check === "up");
    return { ready, checks };
  },
});
// Modules reach the composition root through the runtime container:
// context.application.container.resolve(APP_DEPENDENCIES).
runtime.context.container.registerValue(APP_DEPENDENCIES, dependencies);

const router = createRouter(createApplicationRouterOptions());
registerRoutes(router, dependencies);
// zudojs:server-mounts:start
mountOpenAPI(router, { info: { title: "zudomart", version: "0.1.0" }, docsPath: config.nodeEnv === "production" ? false : "/docs" });
// zudojs:server-mounts:end

const dispatch: HttpMiddleware = async (context) => {
  try {
    return (await router.dispatch(context.request, { signal: context.signal })).response;
  } catch (error) {
    const response = errorResponse(error);
    if (response !== undefined && response.status < 500) return response;
    logger.error(`Unhandled error: ${context.request.method} ${context.request.path}`, errorDetails(error));
    return response ?? json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" });
  }
};

const pipeline = new HttpMiddlewarePipeline({
  middlewares: [
    securityHeaders(),
    createCorsMiddleware({
      allowOrigin: config.corsOrigins,
      allowHeaders: "Authorization, Content-Type, Idempotency-Key, X-Client-Region, X-Request-Id, X-Chunk-Sha256, If-None-Match",
      exposeHeaders: "ETag, X-Request-Id, Retry-After, Idempotent-Replayed",
      credentials: false,
    }),
    // RATE_LIMIT_MAX=0 turns the limit off (load tests, local development).
    ...(config.rateLimit.max > 0
      ? [createRateLimitMiddleware({ windowMs: config.rateLimit.windowMs, max: config.rateLimit.max })]
      : []),
    // zudojs:server-middleware:start
    limitRequestBodySize(DEFAULT_REQUEST_BODY_LIMIT_BYTES, [
      { method: "PUT", pathPattern: /^\/api\/v1\/media\/uploads\/[^/]+\/chunks\/\d+\/?$/i, maxBytes: chunkUploadBodyLimitBytes },
    ]),
    // zudojs:server-middleware:end
    addRequestIdResponseHeader(),
    dispatch,
  ],
});

await runtime.start();
registerScheduledJobs(schedules(), dependencies.scheduledJobs);

const server = createHttpServer({
  adapter: createNodeHttpAdapter({
    server: httpServer,
    host: config.host,
    port: config.port,
    maxBodySize: chunkUploadBodyLimitBytes,
  }),
  handler: (request: HttpRequestContext) => pipeline.execute(request, createResponseContext()),
});

await server.start();

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) {
      console.log(`Received ${signal} again: already shutting down.`);
      return;
    }
    stopping = true;
    console.log(`Received ${signal}: shutting down.`);
    void drainIntegrations(integrations)
      .then(() => server.stop())
      .then(() => runtime.stop())
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error(error);
        process.exit(1);
      });
  });
}

console.log(`Listening on http://${config.host}:${server.address?.port ?? config.port}`);
