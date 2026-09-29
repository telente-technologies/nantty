import type { IdentifierHasher, IntelligenceEventSink, IntelligenceRanking } from "../interfaces/intelligence.interface.js";
import { createIntelligenceEventFlushJob } from "../modules/intelligence/jobs/intelligenceEvents.job.js";
import { PrismaIntelligenceOutboxRepository } from "../modules/intelligence/repositories/intelligenceOutbox.prisma.repository.js";
import { InMemoryIntelligenceOutboxRepository } from "../modules/intelligence/repositories/intelligenceOutbox.repository.js";
import { CircuitBreaker } from "../modules/intelligence/services/circuitBreaker.service.js";
import { SignedIntelligenceClient } from "../modules/intelligence/services/intelligenceClient.service.js";
import { IntelligenceEventForwarder } from "../modules/intelligence/services/intelligenceEventForwarder.service.js";
import { FetchIntelligenceTransport, type IntelligenceTransport } from "../modules/intelligence/services/intelligenceTransport.service.js";
import { OpaqueIdentifierHasher } from "../modules/intelligence/services/identifierHashing.service.js";
import { ResilientIntelligence } from "../modules/intelligence/services/resilientIntelligence.service.js";
import type { Core } from "./core.loader.js";

export interface IntelligenceExternalServices {
  readonly intelligenceTransport?: IntelligenceTransport;
}

export function createIntelligenceModule(core: Core, external: IntelligenceExternalServices) {
  const settings = core.settings.intelligence;
  const breaker = new CircuitBreaker(settings.breaker, () => core.clock.now().getTime());
  const client = new SignedIntelligenceClient(settings, external.intelligenceTransport ?? new FetchIntelligenceTransport(), breaker, core.logger);
  const hasher: IdentifierHasher = new OpaqueIdentifierHasher(settings.identifierHashSecret, core.settings.dataEncryptionKey);
  const eventForwarder = new IntelligenceEventForwarder({
    outbox: core.persistence === "prisma" ? new PrismaIntelligenceOutboxRepository() : new InMemoryIntelligenceOutboxRepository(),
    client,
    hasher,
    settings: settings.events,
    clock: core.clock,
    logger: core.logger,
    keepProcessAlive: core.persistence === "prisma",
  });
  const ranking: IntelligenceRanking = new ResilientIntelligence(client);
  const eventSink: IntelligenceEventSink = eventForwarder;
  return {
    client,
    ranking,
    hasher,
    eventSink,
    eventForwarder,
    scheduledJobs: [createIntelligenceEventFlushJob(eventForwarder, settings.events.flushIntervalSeconds)],
  };
}

export type IntelligenceModuleServices = ReturnType<typeof createIntelligenceModule>;
