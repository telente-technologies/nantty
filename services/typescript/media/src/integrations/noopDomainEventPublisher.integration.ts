import type { DomainEventPublisher } from "../interfaces/domainEventPublisher.interface.js";

export const noopDomainEventPublisher: DomainEventPublisher = { publishDomainEvents: async () => undefined };
