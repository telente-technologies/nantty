import { createLogger } from "@zudojs/logger";

import { noReranker, type SearchReranker } from "../../src/interfaces/searchReranker.interface.js";
import { createSearchEventProcessor } from "../../src/modules/indexing/services/searchEventProcessor.service.js";
import { createSearchQueryService } from "../../src/modules/search/services/searchQuery.service.js";
import type { DomainEventEnvelope } from "../../src/types/domainEvent.type.js";
import { InMemorySearchStore } from "./inMemorySearchStore.fake.js";
import { FakeSourceHydrator } from "./sourceFixtures.fake.js";

let sequence = 0;

export function envelope(type: string, data: Record<string, unknown>, occurredAt = "2026-10-03T10:00:00.000Z"): DomainEventEnvelope {
  sequence += 1;
  return { id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`, type, source: "test", subject: "subject", schemaVersion: 1, occurredAt, data };
}

export function createSearchHarness(reranker: SearchReranker = noReranker) {
  const store = new InMemorySearchStore();
  const hydrator = new FakeSourceHydrator();
  const processor = createSearchEventProcessor(store, hydrator, createLogger({ name: "search-test" }), () => 1_000);
  const service = createSearchQueryService(store, store, reranker);
  return { store, hydrator, processor, service };
}
