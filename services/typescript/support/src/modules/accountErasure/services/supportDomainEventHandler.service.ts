import type { Clock } from "../../../interfaces/clock.interface.js";
import type { TicketStore } from "../../../interfaces/ticketStore.interface.js";
import { PoisonEventError } from "../../../errors/support.error.js";
import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";

export const supportConsumedEventTypes = ["account.deletionExecuted"] as const;

function parseEnvelope(body: string): DomainEventEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new PoisonEventError("event body is not JSON");
  }
  const value = parsed as Partial<DomainEventEnvelope>;
  if (typeof value.id !== "string" || typeof value.type !== "string" || typeof value.data !== "object" || value.data === null) throw new PoisonEventError("event envelope is incomplete");
  return value as DomainEventEnvelope;
}

export function createSupportDomainEventHandler(store: TicketStore, clock: Clock) {
  return async (body: string): Promise<"handled" | "ignored" | "duplicate"> => {
    const event = parseEnvelope(body);
    if (!(supportConsumedEventTypes as readonly string[]).includes(event.type)) return "ignored";
    if (await store.hasProcessedEvent(event.id)) return "duplicate";
    const accountId = typeof event.data["accountId"] === "string" ? event.data["accountId"] : event.subject;
    if (typeof accountId !== "string" || accountId === "") throw new PoisonEventError("account.deletionExecuted without accountId");
    await store.anonymizeRequester(accountId, clock.now());
    await store.markEventProcessed(event.id, event.type);
    return "handled";
  };
}
