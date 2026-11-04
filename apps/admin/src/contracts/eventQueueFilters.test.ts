import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterEventQueues } from "@/utils/eventQueueFilters.util";
import type { EventQueueSnapshot } from "@/types/eventOperations.type";

const queues: readonly EventQueueSnapshot[] = [
  { name: "commerce-domain-events", state: "running", messages: 8, messagesReady: 3, messagesUnacknowledged: 5, consumers: 2, deadLetter: false },
  { name: "commerce-domain-events.dlq", state: "idle", messages: 1, messagesReady: 1, messagesUnacknowledged: 0, consumers: 0, deadLetter: true },
  { name: "identity-domain-events", state: "running", messages: 0, messagesReady: 0, messagesUnacknowledged: 0, consumers: 1, deadLetter: false },
];

describe("event queue filters", () => {
  it("returns all queues when no filters are selected", () => {
    assert.deepEqual(filterEventQueues(queues, "", "all"), queues);
  });

  it("searches queue names and broker state case-insensitively", () => {
    assert.deepEqual(filterEventQueues(queues, "  COMMERCE ", "all").map((queue) => queue.name), ["commerce-domain-events", "commerce-domain-events.dlq"]);
    assert.deepEqual(filterEventQueues(queues, "IDLE", "all").map((queue) => queue.name), ["commerce-domain-events.dlq"]);
  });

  it("filters work and dead-letter queues independently", () => {
    assert.deepEqual(filterEventQueues(queues, "", "work").map((queue) => queue.name), ["commerce-domain-events", "identity-domain-events"]);
    assert.deepEqual(filterEventQueues(queues, "", "dead-letter").map((queue) => queue.name), ["commerce-domain-events.dlq"]);
  });

  it("returns an empty result when no queue matches both filters", () => {
    assert.deepEqual(filterEventQueues(queues, "commerce", "work").map((queue) => queue.name), ["commerce-domain-events"]);
    assert.deepEqual(filterEventQueues(queues, "missing", "dead-letter"), []);
  });
});
