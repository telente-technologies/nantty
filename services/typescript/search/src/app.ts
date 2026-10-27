import { createLogger, type Logger } from "@nantty/fastify-platform";
import { createRequestContext } from "@nantty/fastify-platform";
import { createPlatform } from "@nantty/fastify-platform";

import type { SearchConfig } from "./configs/search.config.js";
import { isGatewayIdentityAuthentic } from "./middlewares/gatewayIdentity.middleware.js";
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
import { withRequestMetrics } from "./telemetry/requestMetrics.js";

export interface SearchApp {
  readonly start: () => Promise<number>;
  readonly stop: () => Promise<void>;
}

export async function createSearchApp(config: SearchConfig, consumerFactory: MessageConsumerFactory | undefined, logger: Logger = createLogger({ name: "search" })): Promise<SearchApp> {
  const prisma = createSearchPrisma(config.databaseUrl, config.databaseSchema);
  const indexStore = createSearchIndexPostgresRepository(prisma);
  const reranker = config.intelligence === undefined ? noReranker : createPythonSearchReranker({ ...config.intelligence, hasher: createIdentifierHasher(deriveIdentifierHashSecret(config.intelligence.idHashSecret, config.intelligence.sharedSecret)) });
  const eventProcessor = createSearchEventProcessor(indexStore, createHttpSourceHydrator({ identity: config.identity, commerce: config.commerce, social: config.social }), logger);
  const app = await createPlatform({ name: "search", host: config.host, port: config.port, bodyLimit: 256 * 1024, trustProxy: true, logger: true, rateLimit: false });
  app.addHook("onRequest", async (request, reply) => {
    const context = createRequestContext({
      method: request.method,
      url: request.url,
      path: request.url.split("?", 1)[0] ?? "/",
      headers: Object.fromEntries(Object.entries(request.headers).flatMap(([name, value]) => value === undefined ? [] : [[name, Array.isArray(value) ? value.join(",") : String(value)]])),
    });
    const carriesIdentity = ["x-nantty-account-id", "x-nantty-session-id", "x-nantty-age-bracket", "x-nantty-viewer", "x-nantty-identity-signature"].some((name) => context.getHeader(name) !== undefined);
    if (carriesIdentity && !isGatewayIdentityAuthentic(context, config.gatewayIdentitySecrets ?? [], Math.floor(Date.now() / 1000))) {
      await reply.code(401).send({ message: "The request did not come through the gateway.", code: "GATEWAY_IDENTITY_INVALID" });
    }
  });
  registerRoutes(app, {
    searchService: createSearchQueryService(createSearchQueryPostgresRepository(prisma), indexStore, reranker),
    recentSearches: createRecentSearchPostgresRepository(prisma),
    eventProcessor,
    internalToken: config.internalToken,
    probeDatabase: async () => void (await prisma.processedEvent.count({ take: 1 })),
    ...(config.rabbitMq === undefined ? {} : { probeBroker: checkRabbitMqConnections }),
  });
  const consumers: QueueConsumer[] = [];
  return {
    async start() {
      await app.listen({ host: config.host, port: config.port });
      if (config.consumersEnabled && consumerFactory !== undefined) {
        const consumer = consumerFactory.createConsumer("searchIndexing", config.domainEventsQueue, async (body) => void (await eventProcessor.processBody(body)));
        consumer.start();
        consumers.push(consumer);
      } else if (config.consumersEnabled) logger.warn("no message consumer factory is wired: the index is fed only through POST /internal/search/events");
      const address = app.server.address();
      return typeof address === "object" && address !== null ? address.port : config.port;
    },
    async stop() {
      await Promise.all(consumers.map((consumer) => consumer.stop()));
      await app.close();
      await prisma.$disconnect();
    },
  };
}
