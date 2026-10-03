import { randomUUID } from "node:crypto";

import type { Prisma } from "../generated/prisma/client.js";
import type { Db } from "../types/database.type.js";

export const eventSource = "media";

export interface DomainEventInput {
  readonly eventType: string;
  readonly subject: string;
  readonly data: Prisma.InputJsonValue;
  readonly occurredAt: Date;
}

export async function appendDomainEventsToOutbox(db: Db, events: readonly DomainEventInput[]): Promise<void> {
  if (events.length === 0) return;
  await db.outboxEvent.createMany({
    data: events.map((event) => {
      const id = randomUUID();
      return {
        id,
        eventType: event.eventType,
        subject: event.subject,
        payload: { id, type: event.eventType, source: eventSource, subject: event.subject, schemaVersion: 1, occurredAt: event.occurredAt.toISOString(), data: event.data },
      };
    }),
  });
}
