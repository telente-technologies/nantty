import {
  HttpMiddlewarePipeline,
  createHttpServer,
  createNodeHttpAdapter,
  createResponseContext,
  createRouter,
  type HttpMiddleware,
  type HttpRequestContext,
} from "@zudojs/http";
import { createLogger, type Logger } from "@zudojs/logger";

import type { MediaConfig } from "./configs/media.config.js";
import { createGatewayIdentityMiddleware } from "./middlewares/gatewayIdentity.middleware.js";
import { mediaDomainEventsQueue, mediaJobQueueName } from "./constants/media.constant.js";
import { createMediaDatabase, type MediaDatabase } from "./databases/prisma.database.js";
import { createMediaUrlSigner } from "./integrations/cdnMediaUrlSigner.integration.js";
import { createBrandedDownloadRenderer } from "./integrations/brandedDownloadRenderer.integration.js";
import { createClamAvTcpScanner, skippedMalwareScanner } from "./integrations/clamAvTcpScanner.integration.js";
import { createFfmpegMediaTranscoder } from "./integrations/ffmpegMediaTranscoder.integration.js";
import { createHeicConverter } from "./integrations/heicConverter.integration.js";
import { createHttpModerationClient } from "./integrations/httpModerationClient.integration.js";
import { noopDomainEventPublisher } from "./integrations/noopDomainEventPublisher.integration.js";
import { createRabbitMqJobQueue, startRabbitMqJobConsumer } from "./integrations/rabbitMqJobQueue.integration.js";
import { RabbitMqConnection } from "./integrations/rabbitMqConnection.integration.js";
import { RabbitMqQueueConsumer } from "./integrations/rabbitMqQueueConsumer.integration.js";
import { createRabbitMqDomainEventPublisher } from "./integrations/rabbitMqDomainEventPublisher.integration.js";
import { createS3ObjectStorage } from "./integrations/s3ObjectStorage.integration.js";
import { createSharpImageProcessor } from "./integrations/sharpImageProcessor.integration.js";
import { systemClock } from "./interfaces/clock.interface.js";
import type { JobQueue } from "./interfaces/jobQueue.interface.js";
import type { DomainEventPublisher } from "./interfaces/domainEventPublisher.interface.js";
import { startMaintenanceJob } from "./jobs/maintenance.job.js";
import { createMediaJobHandlers } from "./jobs/mediaJobHandlers.job.js";
import { startOutboxRelay } from "./jobs/outboxRelay.job.js";
import { handleDomainEventForMedia } from "./modules/assets/services/chatMediaExpiryEvent.service.js";
import { registerRoutes } from "./routes/index.js";
import type { HandlerContext } from "./types/handlerContext.type.js";
import { errorToResponse, json } from "./utils/http.util.js";
import { createRouteFactory } from "./utils/route.util.js";
import { dispatchWithRoute, withRequestMetrics } from "./telemetry/requestMetrics.js";

const bodyAllowanceBytes = 1024 * 1024;
const proxiedChunkLimitBytes = 65 * 1024 * 1024;

export interface MediaApp {
  readonly start: () => Promise<number>;
  readonly stop: () => Promise<void>;
}

export function createMediaApp(config: MediaConfig, logger: Logger = createLogger({ name: "media" })): MediaApp {
  const database: MediaDatabase = createMediaDatabase(config.databaseUrl);
  const storage = createS3ObjectStorage(config.storage);
  const rabbitConnection = new RabbitMqConnection(config.rabbitMqUrl, "media", logger);
  const jobQueue = config.rabbitMqUrl === "" ? unavailableJobQueue(logger) : createRabbitMqJobQueue(rabbitConnection);
  const context: HandlerContext = {
    config, database, storage, clock: systemClock,
    urls: createMediaUrlSigner({ config, storage, clock: systemClock }),
    jobs: jobQueue,
    scanner: config.clamAv === undefined ? skippedMalwareScanner : createClamAvTcpScanner(config.clamAv),
    moderation: config.moderation.baseUrl === undefined ? undefined : createHttpModerationClient({ baseUrl: config.moderation.baseUrl, token: config.moderation.token, timeoutMs: config.moderation.timeoutMs }),
    images: createSharpImageProcessor({ convertHeic: createHeicConverter({ heifConvertPath: config.heifConvertPath, ffmpeg: config.ffmpeg }) }),
    transcoder: createFfmpegMediaTranscoder({ config: config.ffmpeg }),
    branding: createBrandedDownloadRenderer({ config: config.ffmpeg }),
  };
  const router = createRouter({
    onError: (error) => errorToResponse(error),
    notFoundHandler: () => json(404, { message: "Not found.", code: "NOT_FOUND" }),
    methodNotAllowedHandler: () => json(405, { message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" }),
  });
  registerRoutes(router, createRouteFactory(config.internalToken), context, database);
  const dispatch: HttpMiddleware = async (requestContext) => {
    try {
      return (await dispatchWithRoute(router, requestContext.request, requestContext.signal)).response;
    } catch (error) {
      logger.error("unhandled error", { path: requestContext.request.path, error: error instanceof Error ? error.message : String(error) });
      return json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" });
    }
  };
  const pipeline = new HttpMiddlewarePipeline({ middlewares: [createGatewayIdentityMiddleware(config.gatewayIdentitySecrets ?? []), dispatch] });
  const server = createHttpServer({
    adapter: createNodeHttpAdapter({ host: config.host, port: config.port, maxBodySize: config.allowProxiedChunks ? proxiedChunkLimitBytes : bodyAllowanceBytes, trustProxy: true }),
    handler: withRequestMetrics((request: HttpRequestContext) => pipeline.execute(request, createResponseContext())),
  });
  const stoppers: (() => void | Promise<void>)[] = [];
  return {
    async start() {
      if (config.storage.createBuckets) await storage.ensureBuckets();
      if (config.ffmpeg.mode === "required" && !(await context.transcoder.isAvailable())) throw new Error("FFMPEG_MODE=required but ffmpeg is not available");
      if (config.ffmpeg.mode !== "disabled" && !(await context.transcoder.isAvailable())) logger.warn("ffmpeg is not available: video and audio uploads will stay in processing until it is installed");
      await server.start();
      if (config.jobsEnabled) {
        const publisher = createDomainEventPublisher(config, logger);
        stoppers.push(startOutboxRelay({ database, publisher, clock: systemClock, logger, intervalMs: config.outboxPollIntervalMs }));
        stoppers.push(() => (publisher as { close?: () => Promise<void> }).close?.());
        stoppers.push(startMaintenanceJob(context, logger, config.sweepIntervalMs));
        if (config.rabbitMqUrl !== "") {
          const jobConsumer = startRabbitMqJobConsumer({ connection: rabbitConnection, queue: mediaJobQueueName, handlers: createMediaJobHandlers(context), prefetch: config.workerConcurrency, logger });
          const eventConsumer = new RabbitMqQueueConsumer(rabbitConnection, { name: mediaDomainEventsQueue, queue: mediaDomainEventsQueue, prefetch: 10, logger, handleMessageBody: (body) => handleDomainEventForMedia(context, JSON.parse(body) as unknown) });
          eventConsumer.start();
          stoppers.push(() => jobConsumer.stop(), () => eventConsumer.stop(), () => rabbitConnection.close());
        } else logger.warn("RABBITMQ_URL is empty: media jobs and events are not consumed");
      }
      return server.address?.port ?? config.port;
    },
    async stop() {
      for (const stop of stoppers) await stop();
      await server.stop();
      await database.disconnect();
    },
  };
}

function unavailableJobQueue(logger: Logger): JobQueue {
  return { enqueueJob: async () => { logger.error("RABBITMQ_URL is empty: media job dropped"); throw new Error("job queue unavailable"); } };
}

function createDomainEventPublisher(config: MediaConfig, logger: Logger): DomainEventPublisher {
  if (config.messageBus === "rabbitmq" && config.rabbitMqUrl !== "") return createRabbitMqDomainEventPublisher(config.rabbitMqUrl);
  logger.warn("RABBITMQ_URL is empty: outbox events are marked published without being sent");
  return noopDomainEventPublisher;
}
