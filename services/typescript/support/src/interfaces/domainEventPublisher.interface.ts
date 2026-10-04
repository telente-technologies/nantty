export interface PublishableDomainEvent {
  readonly id: string;
  readonly eventType: string;
  readonly subject: string;
  readonly payload: unknown;
}

export interface DomainEventPublisher {
  publishDomainEvents(events: readonly PublishableDomainEvent[]): Promise<void>;
}
