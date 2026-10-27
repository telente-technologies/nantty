import { randomUUID } from "node:crypto";

import type { Logger } from "@nantty/fastify-platform";

import type { PrismaClient } from "../databases/prisma.database.js";
import type { DomainEventPublisher } from "../interfaces/domainEventPublisher.interface.js";

const batchSize = 100;
const lockMilliseconds = 30_000;

export async function relayPendingOutboxEvents(prisma: PrismaClient, publisher: DomainEventPublisher, now: () => Date = () => new Date()): Promise<number> {
  const startedAt = now();
  const unlocked = { publishedAt: null, OR: [{ lockedUntil: null }, { lockedUntil: { lt: startedAt } }] };
  const candidates = await prisma.outboxEvent.findMany({ where: unlocked, orderBy: { createdAt: "asc" }, take: batchSize, select: { id: true } });
  if (candidates.length === 0) return 0;
  const lockToken = randomUUID();
  await prisma.outboxEvent.updateMany({ where: { id: { in: candidates.map((row) => row.id) }, ...unlocked }, data: { lockToken, lockedUntil: new Date(startedAt.getTime() + lockMilliseconds), attempts: { increment: 1 } } });
  const claimed = await prisma.outboxEvent.findMany({ where: { lockToken, publishedAt: null }, orderBy: { createdAt: "asc" } });
  if (claimed.length === 0) return 0;
  await publisher.publishDomainEvents(claimed.map((row) => ({ id: row.id, eventType: row.eventType, subject: row.subject, payload: row.payload })));
  await prisma.outboxEvent.updateMany({ where: { id: { in: claimed.map((row) => row.id) }, lockToken }, data: { publishedAt: now(), lockedUntil: null } });
  return claimed.length;
}

export class OutboxRelayJob {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  public constructor(private readonly relay: () => Promise<number>, private readonly logger: Logger, private readonly intervalMs = 1_000) {}

  public async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let relayed: number;
      do relayed = await this.relay();
      while (relayed > 0);
    } catch (error) {
      this.logger.warn("outbox relay failed", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.running = false;
    }
  }

  public start(): void {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
  }

  public stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
  }
}
