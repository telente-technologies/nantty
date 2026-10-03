import { randomUUID } from "node:crypto";

import type { Logger } from "@zudojs/logger";

import type { SocialDatabase } from "../databases/prisma.database.js";
import type { Clock } from "../interfaces/clock.interface.js";
import type { DomainEventPublisher } from "../interfaces/domainEventPublisher.interface.js";

const batchSize = 100;
const lockMilliseconds = 30_000;

export async function relayPendingOutboxEvents(database: SocialDatabase, publisher: DomainEventPublisher, clock: Clock): Promise<number> {
  const now = clock.now();
  const candidates = await database.client.outboxEvent.findMany({
    where: { publishedAt: null, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true },
  });
  if (candidates.length === 0) return 0;
  const lockToken = randomUUID();
  await database.client.outboxEvent.updateMany({
    where: { id: { in: candidates.map((row) => row.id) }, publishedAt: null, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockToken, lockedUntil: new Date(now.getTime() + lockMilliseconds), attempts: { increment: 1 } },
  });
  const claimed = await database.client.outboxEvent.findMany({ where: { lockToken, publishedAt: null }, orderBy: { createdAt: "asc" } });
  if (claimed.length === 0) return 0;
  await publisher.publishDomainEvents(claimed.map((row) => ({ id: row.id, eventType: row.eventType, subject: row.subject, payload: row.payload })));
  await database.client.outboxEvent.updateMany({ where: { id: { in: claimed.map((row) => row.id) }, lockToken }, data: { publishedAt: clock.now(), lockedUntil: null } });
  return claimed.length;
}

export function startOutboxRelay(options: { readonly database: SocialDatabase; readonly publisher: DomainEventPublisher; readonly clock: Clock; readonly logger: Logger; readonly intervalMs: number }): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    try {
      const published = await relayPendingOutboxEvents(options.database, options.publisher, options.clock);
      if (published === batchSize && !stopped) return void setImmediate(() => void tick());
    } catch (error) {
      options.logger.warn("outbox relay batch failed", { error: error instanceof Error ? error.message : String(error) });
    }
    if (!stopped) timer = setTimeout(() => void tick(), options.intervalMs);
  };
  void tick();
  return () => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}
