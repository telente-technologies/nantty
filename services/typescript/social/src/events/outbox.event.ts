import { randomUUID } from "node:crypto";

import type { Prisma } from "../generated/prisma/client.js";
import type { Db } from "../types/database.type.js";
import { markMutedPostNotifications } from "./postNotificationMutes.event.js";

export const eventSource = "social";

export interface DomainEventInput {
  readonly eventType: string;
  readonly subject: string;
  readonly data: Prisma.InputJsonValue;
  readonly occurredAt: Date;
}

export async function appendDomainEventsToOutbox(db: Db, events: readonly DomainEventInput[]): Promise<void> {
  if (events.length === 0) return;
  const annotated = await markMutedPostNotifications(db, events);
  await db.outboxEvent.createMany({
    data: annotated.map((event) => {
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
