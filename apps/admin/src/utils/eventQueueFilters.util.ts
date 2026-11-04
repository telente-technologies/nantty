import type { EventQueueSnapshot } from "@/types/eventOperations.type";

export type EventQueueKindFilter = "all" | "work" | "dead-letter";

export function filterEventQueues(queues: readonly EventQueueSnapshot[], search: string, kind: EventQueueKindFilter): EventQueueSnapshot[] {
  const needle = search.trim().toLowerCase();

  return queues.filter((queue) => {
    const matchesSearch = !needle || queue.name.toLowerCase().includes(needle) || queue.state.toLowerCase().includes(needle);
    const matchesKind = kind === "all" || (kind === "dead-letter" ? queue.deadLetter : !queue.deadLetter);
    return matchesSearch && matchesKind;
  });
}
