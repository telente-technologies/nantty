import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { IntelligenceEventEnvelope } from "../models/intelligenceEvents.model.js";
import type { IntelligenceOutboxRepository, OutboxEventRecord } from "./intelligenceOutbox.repository.js";

export class PrismaIntelligenceOutboxRepository implements IntelligenceOutboxRepository {
  public async add(envelopes: readonly IntelligenceEventEnvelope[], now: Date): Promise<void> {
    if (envelopes.length === 0) return;
    await prisma().intelligenceOutboxEvent.createMany({
      data: envelopes.map((envelope) => ({ eventId: envelope.eventId, envelope: envelope as unknown as Prisma.InputJsonValue, availableAt: now, createdAt: now })),
      skipDuplicates: true,
    });
  }

  public async claimAvailable(limit: number, now: Date, leaseUntil: Date): Promise<readonly string[]> {
    const rows = await prisma().intelligenceOutboxEvent.findMany({ where: { availableAt: { lte: now } }, orderBy: { createdAt: "asc" }, take: limit, select: { eventId: true } });
    const eventIds = rows.map((row) => row.eventId);
    if (eventIds.length === 0) return [];
    await prisma().intelligenceOutboxEvent.updateMany({ where: { eventId: { in: eventIds }, availableAt: { lte: now } }, data: { availableAt: leaseUntil } });
    return eventIds;
  }

  public async findByIds(eventIds: readonly string[]): Promise<readonly OutboxEventRecord[]> {
    const rows = await prisma().intelligenceOutboxEvent.findMany({ where: { eventId: { in: [...eventIds] } } });
    return rows.map((row) => ({ ...row, envelope: row.envelope as unknown as IntelligenceEventEnvelope }));
  }

  public async recordAttempt(eventIds: readonly string[]): Promise<void> {
    await prisma().intelligenceOutboxEvent.updateMany({ where: { eventId: { in: [...eventIds] } }, data: { attempts: { increment: 1 } } });
  }

  public async deleteByIds(eventIds: readonly string[]): Promise<void> {
    await prisma().intelligenceOutboxEvent.deleteMany({ where: { eventId: { in: [...eventIds] } } });
  }

  public async countAvailable(now: Date): Promise<number> {
    return prisma().intelligenceOutboxEvent.count({ where: { availableAt: { lte: now } } });
  }
}
