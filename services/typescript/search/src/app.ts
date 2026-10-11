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

import type { SearchConfig } from "./configs/search.config.js";
import { createGatewayIdentityMiddleware } from "./middlewares/gatewayIdentity.middleware.js";
import { checkRabbitMqConnections } from "./integrations/rabbitMqConnection.integration.js";
import { createSearchPrisma } from "./databases/prisma.database.js";
import { createHttpSourceHydrator } from "./integrations/httpSourceHydrator.integration.js";
import { createPythonSearchReranker } from "./integrations/pythonSearchReranker.integration.js";
import { createIdentifierHasher, deriveIdentifierHashSecret } from "./utils/identifierHashing.util.js";
import type { MessageConsumerFactory, QueueConsumer } from "./interfaces/domainEventConsumer.interface.js";
import { noReranker } from "./interfaces/searchReranker.interface.js";
import { createSearchIndexPostgresRepository } from "./modules/indexing/repositories/searchIndex.postgres.repository.js";
import { createSearchEventProcessor } from "./modules/indexing/services/searchEventProcessor.service.js";
import { createRecentSearchPostgresRepository } from "./modules/recentSearches/repositories/recentSearch.postgres.repository.js";
import { createSearchQueryPostgresRepository } from "./modules/search/repositories/searchQuery.postgres.repository.js";
import { createSearchQueryService } from "./modules/search/services/searchQuery.service.js";
import { registerRoutes } from "./routes/index.js";
import { errorToResponse, json } from "./utils/http.util.js";
import { dispatchWithRoute, withRequestMetrics } from "./telemetry/requestMetrics.js";

export interface SearchApp {
  readonly start: () => Promise<number>;
  readonly stop: () => Promise<void>;
}

export function createSearchApp(config: SearchConfig, consumerFactory: MessageConsumerFactory | undefined, logger: Logger = createLogger({ name: "search" })): SearchApp {
  const prisma = createSearchPrisma(config.databaseUrl, config.databaseSchema);
  const indexStore = createSearchIndexPostgresRepository(prisma);
  const reranker = config.intelligence === undefined ? noReranker : createPythonSearchReranker({ ...config.intelligence, hasher: createIdentifierHasher(deriveIdentifierHashSecret(config.intelligence.idHashSecret, config.intelligence.sharedSecret)) });
  const eventProcessor = createSearchEventProcessor(indexStore, createHttpSourceHydrator({ identity: config.identity, commerce: config.commerce, social: config.social }), logger);
  const router = createRouter({
    onError: (error) => errorToResponse(error) ?? json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" }),
    notFoundHandler: () => json(404, { message: "Not found.", code: "NOT_FOUND" }),
    methodNotAllowedHandler: () => json(405, { message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" }),
  });
  registerRoutes(router, {
    searchService: createSearchQueryService(createSearchQueryPostgresRepository(prisma), indexStore, reranker),
    recentSearches: createRecentSearchPostgresRepository(prisma),
    eventProcessor,
    internalToken: config.internalToken,
    probeDatabase: async () => void (await prisma.processedEvent.count({ take: 1 })),
    ...(config.rabbitMq === undefined ? {} : { probeBroker: checkRabbitMqConnections }),
  });
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
    adapter: createNodeHttpAdapter({ host: config.host, port: config.port, maxBodySize: 256 * 1024, trustProxy: true }),
    handler: withRequestMetrics((request: HttpRequestContext) => pipeline.execute(request, createResponseContext())),
  });
  const consumers: QueueConsumer[] = [];
  return {
    async start() {
      await server.start();
      if (config.consumersEnabled && consumerFactory !== undefined) {
        const consumer = consumerFactory.createConsumer("searchIndexing", config.domainEventsQueue, async (body) => void (await eventProcessor.processBody(body)));
        consumer.start();
        consumers.push(consumer);
      } else if (config.consumersEnabled) {
        logger.warn("no message consumer factory is wired: the index is fed only through POST /internal/search/events");
      }
      return server.address?.port ?? config.port;
    },
    async stop() {
      await Promise.all(consumers.map((consumer) => consumer.stop()));
      await server.stop();
      await prisma.$disconnect();
    },
  };
}
