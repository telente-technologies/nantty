import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../generated/prisma/client.js";
import type { Clock } from "../interfaces/clock.interface.js";
import type { DomainEventPublisher } from "../interfaces/domainEventPublisher.interface.js";

const batchSize = 100;
const lockMilliseconds = 30_000;

export async function relayPendingOutboxEvents(prisma: PrismaClient, publisher: DomainEventPublisher, clock: Clock): Promise<number> {
  const now = clock.now();
  const unlocked = { publishedAt: null, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] };
  const candidates = await prisma.outboxEvent.findMany({ where: unlocked, orderBy: { createdAt: "asc" }, take: batchSize, select: { id: true } });
  if (candidates.length === 0) return 0;
  const lockToken = randomUUID();
  await prisma.outboxEvent.updateMany({ where: { id: { in: candidates.map((row) => row.id) }, ...unlocked }, data: { lockToken, lockedUntil: new Date(now.getTime() + lockMilliseconds), attempts: { increment: 1 } } });
  const claimed = await prisma.outboxEvent.findMany({ where: { lockToken, publishedAt: null }, orderBy: { createdAt: "asc" } });
  if (claimed.length === 0) return 0;
  await publisher.publishDomainEvents(claimed.map((row) => ({ id: row.id, eventType: row.eventType, subject: row.subject, payload: row.payload })));
  await prisma.outboxEvent.updateMany({ where: { id: { in: claimed.map((row) => row.id) }, lockToken }, data: { publishedAt: clock.now(), lockedUntil: null } });
  return claimed.length;
}
