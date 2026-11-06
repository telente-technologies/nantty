import type { PrismaClient } from "../../../databases/prisma.database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { DeliveryClaim, DeliveryRepository } from "../../../interfaces/repositories.interface.js";
import type { DeliveryStatus } from "../../../types/notification.type.js";
import { sanitizePushFailureReason } from "../../../utils/pushFailure.util.js";

const pendingDeliveryLeaseMs = 15 * 60 * 1000;
const maximumEmailAttempts = 4;

export class DeliveryPrismaRepository implements DeliveryRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async claim(input: Parameters<DeliveryRepository["claim"]>[0]): Promise<DeliveryClaim> {
    try {
      const row = await this.prisma.delivery.create({ data: { ...input, status: "pending", attemptCount: 1, lastAttemptAt: new Date() } });
      return { id: row.id, status: "pending", attemptCount: row.attemptCount, alreadyProcessed: false };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
    const existing = await this.prisma.delivery.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey } });
    if (input.channel === "email" && existing.status === "failed" && existing.attemptCount >= maximumEmailAttempts) {
      return { id: existing.id, status: "failed", attemptCount: existing.attemptCount, alreadyProcessed: true };
    }
    const staleBefore = new Date(Date.now() - pendingDeliveryLeaseMs);
    const reclaimable = existing.status === "failed" || (existing.status === "pending" && existing.updatedAt < staleBefore);
    if (!reclaimable) return { id: existing.id, status: existing.status as DeliveryStatus, attemptCount: existing.attemptCount, alreadyProcessed: true };

    const retry = await this.prisma.delivery.updateMany({
      where: { id: existing.id, status: existing.status, attemptCount: existing.attemptCount, ...(existing.status === "pending" ? { updatedAt: { lt: staleBefore } } : {}) },
      data: { status: "pending", attemptCount: { increment: 1 }, lastAttemptAt: new Date(), failedAt: null, skipReason: null },
    });
    if (retry.count === 1) return { id: existing.id, status: "pending", attemptCount: existing.attemptCount + 1, alreadyProcessed: false };

    const current = await this.prisma.delivery.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey } });
    return { id: current.id, status: current.status as DeliveryStatus, attemptCount: current.attemptCount, alreadyProcessed: true };
  }

  public async finish(id: string, status: DeliveryStatus, detail: { readonly skipReason?: string; readonly providerMessageId?: string }): Promise<void> {
    await this.prisma.delivery.update({ where: { id }, data: { status, skipReason: detail.skipReason ?? null, providerMessageId: detail.providerMessageId ?? null, failedAt: status === "failed" ? new Date() : null } });
  }

  public countSentEmails(userId: string, mailKind: Parameters<DeliveryRepository["countSentEmails"]>[1], since: Date): Promise<number> {
    return this.prisma.delivery.count({ where: { userId, channel: "email", mailKind, status: "sent", createdAt: { gte: since } } });
  }

  public async listFailedEmails(limit: number) {
    const rows = await this.prisma.delivery.findMany({
      where: { channel: "email", status: "failed" },
      orderBy: { failedAt: "desc" },
      take: Math.max(1, Math.min(100, limit)),
      select: { id: true, eventId: true, templateKey: true, attemptCount: true, failedAt: true, skipReason: true },
    });
    return rows.map((row) => ({ id: row.id, eventId: row.eventId, templateKey: row.templateKey, attemptCount: row.attemptCount, failedAt: row.failedAt, reason: row.skipReason }));
  }

  public async listFailedPushes(limit: number) {
    const rows = await this.prisma.delivery.findMany({
      where: { channel: "push", status: "failed" },
      orderBy: { failedAt: "desc" },
      take: Math.max(1, Math.min(100, limit)),
      // Deliberately omit userId, payload, device tokens, and provider response bodies.
      select: { id: true, eventId: true, templateKey: true, attemptCount: true, failedAt: true, skipReason: true },
    });
    return rows.map((row) => ({ id: row.id, eventId: row.eventId, templateKey: row.templateKey, attemptCount: row.attemptCount, failedAt: row.failedAt, reason: sanitizePushFailureReason(row.skipReason) }));
  }

  public async findUserIdByProviderMessageId(providerMessageId: string): Promise<string | null> {
    return (await this.prisma.delivery.findFirst({ where: { providerMessageId }, select: { userId: true } }))?.userId ?? null;
  }
}
