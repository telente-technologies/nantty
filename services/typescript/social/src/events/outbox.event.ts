import { createHash, randomUUID } from "node:crypto";

import type { Prisma } from "../generated/prisma/client.js";
import type { Db } from "../types/database.type.js";
import { markMutedPostNotifications } from "./postNotificationMutes.event.js";

export const eventSource = "social";

export interface DomainEventInput {
  readonly id?: string;
  readonly eventType: string;
  readonly subject: string;
  readonly data: Prisma.InputJsonValue;
  readonly occurredAt: Date;
}

const EVENT_ID_NAMESPACE = "5d8cb1b7-97ac-4e5b-8f22-6cc76a0f6b5a";

/** Stable IDs let recurring schedulers safely retry the same logical event. */
export function deterministicDomainEventId(key: string): string {
  const bytes = createHash("sha1").update(EVENT_ID_NAMESPACE).update(":").update(key).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function appendDomainEventsToOutbox(db: Db, events: readonly DomainEventInput[]): Promise<void> {
  if (events.length === 0) return;
  const annotated = await markMutedPostNotifications(db, events);
  await db.outboxEvent.createMany({
    data: annotated.map((event) => {
      const id = event.id ?? randomUUID();
      return {
        id,
        eventType: event.eventType,
        subject: event.subject,
        payload: { id, type: event.eventType, source: eventSource, subject: event.subject, schemaVersion: 1, occurredAt: event.occurredAt.toISOString(), data: event.data },
      };
    }),
    skipDuplicates: true,
  });
}
