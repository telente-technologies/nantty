import type { DomainEventEnvelope } from "../../../../types/domainEvent.type.js";

export interface HandleDomainEventCommand {
  readonly event: DomainEventEnvelope;
}

export type HandleDomainEventResult = { readonly handled: boolean; readonly intents: number; readonly reason?: string };
