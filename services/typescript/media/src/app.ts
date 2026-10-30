import { createLogger, type Logger } from "@nantty/fastify-platform";

import type { MediaConfig } from "./configs/media.config.js";
import { createMediaHttpApp } from "./httpApp.js";
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
import type { HandlerContext } from "./types/handlerContext.type.js";

export interface MediaApp {
  readonly start: () => Promise<number>;
  readonly stop: () => Promise<void>;
}

export async function createMediaApp(config: MediaConfig, logger: Logger = createLogger({ name: "media" })): Promise<MediaApp> {
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
  const server = await createMediaHttpApp(context, database);
  const stoppers: (() => void | Promise<void>)[] = [];
  return {
    async start() {
      if (config.storage.createBuckets) await storage.ensureBuckets();
      if (config.ffmpeg.mode === "required" && !(await context.transcoder.isAvailable())) throw new Error("FFMPEG_MODE=required but ffmpeg is not available");
      if (config.ffmpeg.mode !== "disabled" && !(await context.transcoder.isAvailable())) logger.warn("ffmpeg is not available: video and audio uploads will stay in processing until it is installed");
      if (config.allowUnscannedUploads) logger.warn("MEDIA_ALLOW_UNSCANNED is enabled: uploads will be published without a malware scan");
      await server.listen({ host: config.host, port: config.port });
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
      const address = server.server.address();
      return typeof address === "object" && address !== null ? address.port : config.port;
    },
    async stop() {
      for (const stop of stoppers) await stop();
      await server.close();
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
