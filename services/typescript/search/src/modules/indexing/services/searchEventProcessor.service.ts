import type { Logger } from "@zudojs/logger";

import type { SearchIndexStore } from "../../../interfaces/searchStore.interface.js";
import type { SourceHydrator } from "../../../interfaces/sourceHydrator.interface.js";
import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";
import { createDocumentReindexer } from "./documentReindexer.service.js";
import { parseEnvelope } from "./eventPayloadReader.service.js";
import { createSearchEventHandlers } from "./searchEventHandlers.service.js";

export interface SearchEventProcessor {
  readonly process: (envelope: DomainEventEnvelope) => Promise<"handled" | "duplicate" | "ignored">;
  readonly processBody: (body: string) => Promise<"handled" | "duplicate" | "ignored">;
  readonly eventTypes: readonly string[];
}

export function createSearchEventProcessor(store: SearchIndexStore, hydrator: SourceHydrator, logger: Logger, nowMilliseconds: () => number = Date.now): SearchEventProcessor {
  const handlers = createSearchEventHandlers(store, createDocumentReindexer(store, hydrator), nowMilliseconds);
  const process = async (envelope: DomainEventEnvelope) => {
    const handler = handlers[envelope.type];
    if (handler === undefined) return "ignored" as const;
    if (!(await store.claimEvent(envelope.id))) return "duplicate" as const;
    try {
      await handler(envelope);
      return "handled" as const;
    } catch (error) {
      await store.releaseEvent(envelope.id);
      logger.warn("search indexing failed", { type: envelope.type, eventId: envelope.id, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  };
  return { process, processBody: async (body) => process(parseEnvelope(body)), eventTypes: Object.keys(handlers) };
}
