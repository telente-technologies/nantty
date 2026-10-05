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

import type { SocialConfig } from "./configs/social.config.js";
import { createGatewayIdentityMiddleware } from "./middlewares/gatewayIdentity.middleware.js";
import { createSocialDatabase, type SocialDatabase } from "./databases/prisma.database.js";
import { createIdentityReadClient } from "./databases/identityRead.database.js";
import { createIdempotencyGuard } from "./middlewares/idempotency.middleware.js";
import { createIdentityDirectory } from "./integrations/identityDirectory.integration.js";
import { deterministicFeedRanker } from "./integrations/deterministicFeedRanker.integration.js";
import { createAdminRankingSettingsSource, staticRankingSettings } from "./integrations/adminRankingSettings.integration.js";
import { createIdentityAuthorRankingDirectory } from "./integrations/identityAuthorRanking.integration.js";
import { createIntelligenceExploreClient } from "./integrations/intelligenceExplore.integration.js";
import { createIntelligenceFeedRanker } from "./integrations/intelligenceFeedRanker.integration.js";
import type { FeedRanker } from "./interfaces/feedRanker.interface.js";
import { createHttpShareCardResolver } from "./integrations/httpShareCardResolver.integration.js";
import { createHttpLinkPreviewImageStore } from "./integrations/httpLinkPreviewImageStore.integration.js";
import { createSafeHttpFetcher } from "./integrations/safeHttpFetcher.integration.js";
import { createLinkUnfurler } from "./modules/linkPreviews/services/linkUnfurler.service.js";
import { createHttpMediaDownloadVariantClient } from "./integrations/httpMediaDownloadVariantClient.integration.js";
import { createHttpMediaDescriptorResolver } from "./integrations/httpMediaDescriptorResolver.integration.js";
import { createHttpPremiumEntitlements, noPremiumEntitlements } from "./integrations/premiumEntitlements.integration.js";
import { createRabbitMqDomainEventPublisher } from "./integrations/rabbitMqDomainEventPublisher.integration.js";
import { createSnsDomainEventPublisher, noopDomainEventPublisher } from "./integrations/snsDomainEventPublisher.integration.js";
import type { DomainEventPublisher } from "./interfaces/domainEventPublisher.interface.js";
import { systemClock } from "./interfaces/clock.interface.js";
import { startChatMediaExpiryJob } from "./jobs/scheduler.job.js";
import { startContentEventConsumer } from "./jobs/contentEvents.job.js";
import { createRabbitMqMessageConsumerFactory } from "./integrations/rabbitMqMessageConsumerFactory.integration.js";
import { startOutboxRelay } from "./jobs/outboxRelay.job.js";
import { registerRoutes } from "./routes/index.js";
import type { HandlerContext } from "./types/handlerContext.type.js";
import { errorToResponse, json } from "./utils/http.util.js";
import { createRouteFactory } from "./utils/route.util.js";

const maximumRequestBodyBytes = 1024 * 1024;

export interface SocialApp {
  readonly start: () => Promise<number>;
  readonly stop: () => Promise<void>;
}

export function createSocialApp(config: SocialConfig, internalToken: string, logger: Logger = createLogger({ name: "social" })): SocialApp {
  const database: SocialDatabase = createSocialDatabase(config.databaseUrl);
  const identityClient = createIdentityReadClient(config.identityReadDatabaseUrl);
  const premium = config.moneyInternal === undefined ? noPremiumEntitlements : createHttpPremiumEntitlements(config.moneyInternal);
  const context: HandlerContext = {
    database,
    directory: createIdentityDirectory(identityClient, logger),
    clock: systemClock,
    premium,
    ranker: createFeedRanker(config, logger),
    authorRanking: createIdentityAuthorRankingDirectory(identityClient, logger, config.moneyInternal === undefined ? undefined : premium),
    rankingSettings: config.adminInternal === undefined ? staticRankingSettings : createAdminRankingSettingsSource(config.adminInternal),
    ...(config.intelligence === undefined ? {} : { intelligenceExplore: createIntelligenceExploreClient({ baseUrl: config.intelligence.baseUrl, sharedSecret: config.intelligence.sharedSecret, timeoutMs: config.intelligence.exploreTimeoutMs }) }),
    shareCards: createHttpShareCardResolver({ commerce: config.commerceInternal, live: config.liveInternal }),
    ...(config.mediaInternal === undefined ? {} : { media: createHttpMediaDescriptorResolver(config.mediaInternal), mediaDownloads: createHttpMediaDownloadVariantClient(config.mediaInternal) }),
    ...(config.linkPreviewsEnabled ? { linkPreviews: createLinkUnfurler({ db: database.client, fetcher: createSafeHttpFetcher(), clock: systemClock, imageStore: config.mediaInternal === undefined ? undefined : createHttpLinkPreviewImageStore(config.mediaInternal, config.linkPreviewMediaOwnerId) }) } : {}),
  };
  const router = createRouter({
    onError: (error) => errorToResponse(error),
    notFoundHandler: () => json(404, { message: "Not found.", code: "NOT_FOUND" }),
    methodNotAllowedHandler: () => json(405, { message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" }),
  });
  registerRoutes(router, createRouteFactory(createIdempotencyGuard(database)), context, database, internalToken);
  const dispatch: HttpMiddleware = async (requestContext) => {
    try {
      return (await router.dispatch(requestContext.request, { signal: requestContext.signal })).response;
    } catch (error) {
      logger.error("unhandled error", { path: requestContext.request.path, error: error instanceof Error ? error.message : String(error) });
      return json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" });
    }
  };
  const pipeline = new HttpMiddlewarePipeline({ middlewares: [createGatewayIdentityMiddleware(config.gatewayIdentitySecrets ?? []), dispatch] });
  const server = createHttpServer({
    adapter: createNodeHttpAdapter({ host: config.host, port: config.port, maxBodySize: maximumRequestBodyBytes, trustProxy: true }),
    handler: (request: HttpRequestContext) => pipeline.execute(request, createResponseContext()),
  });
  const stoppers: (() => void)[] = [];
  return {
    async start() {
      await server.start();
      if (config.jobsEnabled) {
        const publisher = createDomainEventPublisher(config, logger);
        stoppers.push(startOutboxRelay({ database, publisher, clock: systemClock, logger, intervalMs: config.outboxPollIntervalMs }));
        stoppers.push(() => void (publisher as { close?: () => Promise<void> }).close?.());
        stoppers.push(startChatMediaExpiryJob(context, logger, config.mediaExpiryIntervalMs));
        if (config.messageBus === "rabbitmq" && config.rabbitMqUrl !== "") {
          const consumers = createRabbitMqMessageConsumerFactory(config.rabbitMqUrl, config.rabbitMqPrefetch, logger);
          const stopConsumer = startContentEventConsumer(context, consumers, config.domainEventsQueue, config.mediaPublicBaseUrl, logger);
          stoppers.push(() => void stopConsumer().finally(() => consumers.close()));
        }
      }
      return server.address?.port ?? config.port;
    },
    async stop() {
      for (const stop of stoppers) stop();
      await server.stop();
      await database.disconnect();
      await identityClient.$disconnect();
    },
  };
}

function createFeedRanker(config: SocialConfig, logger: Logger): FeedRanker {
  if (config.intelligence === undefined) return deterministicFeedRanker;
  let fallbackCount = 0;
  return createIntelligenceFeedRanker({
    baseUrl: config.intelligence.baseUrl,
    sharedSecret: config.intelligence.sharedSecret,
    timeoutMs: config.intelligence.feedRankTimeoutMs,
    fallback: deterministicFeedRanker,
    onFallback: (reason) => {
      fallbackCount += 1;
      if (fallbackCount % 100 === 1) logger.warn("feed ranking fell back to the deterministic ranker", { reason, fallbackCount });
    },
  });
}

function createDomainEventPublisher(config: SocialConfig, logger: Logger): DomainEventPublisher {
  if (config.messageBus === "rabbitmq" && config.rabbitMqUrl !== "") return createRabbitMqDomainEventPublisher(config.rabbitMqUrl);
  if (config.messageBus === "sqs" && config.domainEventsTopicArn !== "") return createSnsDomainEventPublisher({ topicArn: config.domainEventsTopicArn, region: config.awsRegion, endpoint: config.awsEndpointUrl });
  logger.warn(`${config.messageBus === "sqs" ? "DOMAIN_EVENTS_TOPIC_ARN" : "RABBITMQ_URL"} is empty: outbox events are marked published without being sent`);
  return noopDomainEventPublisher;
}
