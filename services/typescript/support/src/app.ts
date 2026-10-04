import { fileURLToPath } from "node:url";

import { HttpMiddlewarePipeline, createHttpServer, createNodeHttpAdapter, createResponseContext, type HttpMiddleware, type HttpRequestContext } from "@zudojs/http";
import { createLogger, type Logger } from "@zudojs/logger";

import type { SupportConfig } from "./configs/support.config.js";
import { autoCloseResolvedAfterDays } from "./constants/support.constant.js";
import { createSupportPrisma } from "./databases/prisma.database.js";
import { createIdentityHttpDirectory } from "./integrations/identityDirectory.integration.js";
import { createIntelligenceHelpWriter } from "./integrations/intelligenceHelpWriter.integration.js";
import { systemClock } from "./interfaces/clock.interface.js";
import type { MessageConsumerFactory, QueueConsumer } from "./interfaces/domainEventConsumer.interface.js";
import type { DomainEventPublisher } from "./interfaces/domainEventPublisher.interface.js";
import { noHelpAnswerWriter } from "./interfaces/helpAnswerWriter.interface.js";
import { offlineIdentityDirectory } from "./interfaces/identityDirectory.interface.js";
import { processQueuedAutoFaqTickets } from "./jobs/autoFaq.job.js";
import { relayPendingOutboxEvents } from "./jobs/outboxRelay.job.js";
import { startScheduledTasks } from "./jobs/scheduler.job.js";
import { readSeedArticles, seedHelpContent } from "./loaders/helpContentSeed.loader.js";
import { createJwtStaffAuthenticator, unavailableStaffAuthenticator } from "./middlewares/staffAuth.middleware.js";
import { createSupportDomainEventHandler } from "./modules/accountErasure/services/supportDomainEventHandler.service.js";
import { AutoFaqPublisher } from "./modules/autoFaq/services/autoFaqPublisher.service.js";
import { createHelpContentPrismaRepository } from "./modules/helpContent/repositories/helpContent.prisma.repository.js";
import { createTicketPrismaRepository } from "./modules/tickets/repositories/ticket.prisma.repository.js";
import { buildSupportRouter } from "./routes/index.js";
import { json } from "./utils/http.util.js";

export interface SupportApp {
  readonly start: () => Promise<number>;
  readonly stop: () => Promise<void>;
}

const contentDirectory = fileURLToPath(new URL("../content/help", import.meta.url));

export function createSupportApp(config: SupportConfig, infrastructure: { readonly publisher?: DomainEventPublisher; readonly consumerFactory?: MessageConsumerFactory }, logger: Logger = createLogger({ name: "support" })): SupportApp {
  const prisma = createSupportPrisma(config.databaseUrl, config.databaseSchema);
  const ticketStore = createTicketPrismaRepository(prisma);
  const helpStore = createHelpContentPrismaRepository(prisma);
  const identity = config.identity === undefined ? offlineIdentityDirectory : createIdentityHttpDirectory(config.identity.baseUrl, config.identity.internalToken);
  const publisher = new AutoFaqPublisher({ helpStore, writer: config.intelligence === undefined ? noHelpAnswerWriter : createIntelligenceHelpWriter(config.intelligence) });
  const runAutoFaqNow = () => processQueuedAutoFaqTickets(ticketStore, publisher, systemClock, logger);
  const router = buildSupportRouter({
    ticketStore, helpStore, identity, clock: systemClock, internalToken: config.internalToken, mediaPublicBaseUrls: config.mediaPublicBaseUrls, runAutoFaqNow,
    staffAuthenticator: config.staffAuth === undefined ? unavailableStaffAuthenticator : createJwtStaffAuthenticator(config.staffAuth),
    probeDatabase: async () => void (await prisma.supportSetting.count({ take: 1 })),
  });
  const dispatch: HttpMiddleware = async (requestContext) => {
    try {
      return (await router.dispatch(requestContext.request, { signal: requestContext.signal })).response;
    } catch (error) {
      logger.error("unhandled error", { path: requestContext.request.path, error: error instanceof Error ? error.message : String(error) });
      return json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" });
    }
  };
  const pipeline = new HttpMiddlewarePipeline({ middlewares: [dispatch] });
  const server = createHttpServer({
    adapter: createNodeHttpAdapter({ host: config.host, port: config.port, maxBodySize: 256 * 1024, trustProxy: true }),
    handler: (request: HttpRequestContext) => pipeline.execute(request, createResponseContext()),
  });
  const consumers: QueueConsumer[] = [];
  let stopTasks: (() => void) | undefined;
  return {
    async start() {
      if (config.seedHelpContent) {
        const seeded = await seedHelpContent(helpStore, await readSeedArticles(contentDirectory), logger);
        logger.info("help content seeded", seeded);
      }
      await server.start();
      if (config.jobsEnabled) {
        const relay = infrastructure.publisher;
        stopTasks = startScheduledTasks([
          { name: "autoFaq", intervalMs: 30_000, run: runAutoFaqNow },
          { name: "autoCloseResolvedTickets", intervalMs: 3_600_000, run: () => ticketStore.closeResolvedTicketsBefore(new Date(Date.now() - autoCloseResolvedAfterDays * 86_400_000), new Date()) },
          ...(relay === undefined ? [] : [{ name: "outboxRelay", intervalMs: 1_000, run: () => relayPendingOutboxEvents(prisma, relay, systemClock) }]),
        ], logger);
      }
      if (config.consumersEnabled && infrastructure.consumerFactory !== undefined) {
        const handle = createSupportDomainEventHandler(ticketStore, systemClock);
        const consumer = infrastructure.consumerFactory.createConsumer("supportDomainEvents", config.domainEventsQueue, async (body) => void (await handle(body)));
        consumer.start();
        consumers.push(consumer);
      }
      return server.address?.port ?? config.port;
    },
    async stop() {
      stopTasks?.();
      await Promise.all(consumers.map((consumer) => consumer.stop()));
      await server.stop();
      await prisma.$disconnect();
    },
  };
}
