import { randomUUID } from "node:crypto";

export const eventSource = "support";

export interface DomainEventInput {
  readonly eventType: string;
  readonly subject: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
}

export interface OutboxRow {
  readonly id: string;
  readonly eventType: string;
  readonly subject: string;
  readonly payload: Record<string, unknown>;
}

export function buildOutboxRows(events: readonly DomainEventInput[]): OutboxRow[] {
  return events.map((event) => {
    const id = randomUUID();
    return {
      id,
      eventType: event.eventType,
      subject: event.subject,
      payload: { id, type: event.eventType, source: eventSource, subject: event.subject, schemaVersion: 1, occurredAt: event.occurredAt.toISOString(), data: event.data },
    };
  });
}
