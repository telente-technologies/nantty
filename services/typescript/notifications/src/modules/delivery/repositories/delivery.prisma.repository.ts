import type { PrismaClient } from "../../../databases/prisma.database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { DeliveryClaim, DeliveryRepository } from "../../../interfaces/repositories.interface.js";
import type { DeliveryStatus } from "../../../types/notification.type.js";

export class DeliveryPrismaRepository implements DeliveryRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async claim(input: Parameters<DeliveryRepository["claim"]>[0]): Promise<DeliveryClaim> {
    try {
      const row = await this.prisma.delivery.create({ data: { ...input, status: "pending" } });
      return { id: row.id, status: "pending", alreadyProcessed: false };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
    const existing = await this.prisma.delivery.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey } });
    const retryable = existing.status === "pending" || existing.status === "failed";
    if (retryable) await this.prisma.delivery.update({ where: { id: existing.id }, data: { status: "pending", skipReason: null } });
    return { id: existing.id, status: existing.status as DeliveryStatus, alreadyProcessed: !retryable };
  }

  public async finish(id: string, status: DeliveryStatus, detail: { readonly skipReason?: string; readonly providerMessageId?: string }): Promise<void> {
    await this.prisma.delivery.update({ where: { id }, data: { status, skipReason: detail.skipReason ?? null, providerMessageId: detail.providerMessageId ?? null } });
  }

  public countSentEmails(userId: string, mailKind: Parameters<DeliveryRepository["countSentEmails"]>[1], since: Date): Promise<number> {
    return this.prisma.delivery.count({ where: { userId, channel: "email", mailKind, status: "sent", createdAt: { gte: since } } });
  }

  public async findUserIdByProviderMessageId(providerMessageId: string): Promise<string | null> {
    return (await this.prisma.delivery.findFirst({ where: { providerMessageId }, select: { userId: true } }))?.userId ?? null;
  }
}
