import type { PrismaClient } from "../../../databases/prisma.database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { ReengagementRepository, ReengagementStatus, ReengagementWorkItem } from "../../../interfaces/reengagementRepository.interface.js";

type WorkItemRow = Prisma.ReengagementDeliveryGetPayload<{ include: { activity: { select: { accountId: true; lastActivityAt: true; timeZone: true; lastReengagementAttemptAt: true } } } }>;

export class ReengagementPrismaRepository implements ReengagementRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async recordActivity(accountId: string, timeZone: string, at: Date): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.activityHeartbeat.upsert({
        where: { accountId },
        create: { accountId, timeZone, lastActivityAt: at },
        update: { timeZone, lastActivityAt: at },
      });
      await transaction.reengagementDelivery.updateMany({
        where: { accountId, status: "pending" },
        data: { status: "skipped", outcomeReason: "new_activity" },
      });
    });
  }

  public async createDueDeliveries(input: Parameters<ReengagementRepository["createDueDeliveries"]>[0]): Promise<number> {
    const activities = await this.prisma.activityHeartbeat.findMany({
      where: {
        lastActivityAt: { lte: input.inactiveBefore },
        OR: [{ lastReengagementAttemptAt: null }, { lastReengagementAttemptAt: { lt: input.cooldownBefore } }],
        reengagementDeliveries: { none: { campaignId: input.campaignId, contentKey: input.contentKey } },
      },
      orderBy: [{ lastActivityAt: "asc" }, { accountId: "asc" }],
      take: input.limit,
      select: { accountId: true, lastActivityAt: true },
    });
    if (activities.length === 0) return 0;
    const created = await this.prisma.reengagementDelivery.createMany({
      data: activities.map((activity) => ({
        accountId: activity.accountId,
        campaignId: input.campaignId,
        contentKey: input.contentKey,
        dedupeKey: `${activity.accountId}:${input.campaignId}:${input.contentKey}`,
        activityAt: activity.lastActivityAt,
      })),
      skipDuplicates: true,
    });
    return created.count;
  }

  public async listPending(input: Parameters<ReengagementRepository["listPending"]>[0]): Promise<readonly ReengagementWorkItem[]> {
    const rows = await this.prisma.reengagementDelivery.findMany({
      where: {
        status: "pending",
        activity: { lastActivityAt: { lte: input.inactiveBefore } },
        OR: [{ queueLeaseUntil: null }, { queueLeaseUntil: { lte: input.now } }],
      },
      include: { activity: { select: { accountId: true, lastActivityAt: true, timeZone: true, lastReengagementAttemptAt: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: input.limit,
    });
    return rows.map((row) => this.toWorkItem(row));
  }

  public async leaseForQueue(id: string, now: Date, leaseUntil: Date, token: string): Promise<boolean> {
    const result = await this.prisma.reengagementDelivery.updateMany({
      where: { id, status: "pending", OR: [{ queueLeaseUntil: null }, { queueLeaseUntil: { lte: now } }] },
      data: { queueLeaseUntil: leaseUntil, queueLockToken: token },
    });
    return result.count === 1;
  }

  public async releaseQueueLease(id: string, token: string): Promise<void> {
    await this.prisma.reengagementDelivery.updateMany({
      where: { id, status: "pending", queueLockToken: token },
      data: { queueLeaseUntil: null, queueLockToken: null },
    });
  }

  public async findWorkItem(id: string): Promise<ReengagementWorkItem | null> {
    const row = await this.prisma.reengagementDelivery.findUnique({
      where: { id },
      include: { activity: { select: { accountId: true, lastActivityAt: true, timeZone: true, lastReengagementAttemptAt: true } } },
    });
    return row === null ? null : this.toWorkItem(row);
  }

  public async skipPending(id: string, reason: string): Promise<void> {
    await this.prisma.reengagementDelivery.updateMany({
      where: { id, status: "pending" },
      data: { status: "skipped", outcomeReason: reason.slice(0, 200), queueLeaseUntil: null, queueLockToken: null },
    });
  }

  public async claimDispatch(input: Parameters<ReengagementRepository["claimDispatch"]>[0]): Promise<"claimed" | "already_claimed" | "recent_activity" | "frequency_cap"> {
    return this.prisma.$transaction(async (transaction) => {
      const candidate = await transaction.reengagementDelivery.findUnique({ where: { id: input.id }, select: { accountId: true } });
      if (candidate === null) return "already_claimed";
      const claim = await transaction.reengagementDelivery.updateMany({ where: { id: input.id, status: "pending" }, data: { status: "dispatching", queueLeaseUntil: null, queueLockToken: null } });
      if (claim.count !== 1) return "already_claimed";

      const cooldown = await transaction.activityHeartbeat.updateMany({
        where: {
          accountId: candidate.accountId,
          lastActivityAt: { lte: input.inactiveBefore },
          OR: [{ lastReengagementAttemptAt: null }, { lastReengagementAttemptAt: { lt: input.cooldownBefore } }],
        },
        data: { lastReengagementAttemptAt: input.now },
      });
      if (cooldown.count === 1) return "claimed";

      const activity = await transaction.activityHeartbeat.findUnique({ where: { accountId: candidate.accountId }, select: { lastActivityAt: true } });
      const reason = activity !== null && activity.lastActivityAt > input.inactiveBefore ? "new_activity" : "weekly_cap";
      await transaction.reengagementDelivery.update({ where: { id: input.id }, data: { status: "skipped", outcomeReason: reason } });
      return reason === "new_activity" ? "recent_activity" : "frequency_cap";
    });
  }

  public async finish(id: string, status: Exclude<ReengagementStatus, "pending" | "dispatching">, reason?: string): Promise<void> {
    await this.prisma.reengagementDelivery.updateMany({
      where: { id, status: "dispatching" },
      data: { status, outcomeReason: reason?.slice(0, 200) ?? null, sentAt: status === "sent" ? new Date() : null },
    });
  }

  private toWorkItem(row: WorkItemRow): ReengagementWorkItem {
    return {
      id: row.id,
      accountId: row.accountId,
      campaignId: row.campaignId,
      contentKey: row.contentKey,
      dedupeKey: row.dedupeKey,
      activityAt: row.activityAt,
      status: row.status as ReengagementStatus,
      activity: {
        accountId: row.activity.accountId,
        lastActivityAt: row.activity.lastActivityAt,
        timeZone: row.activity.timeZone,
        lastReengagementAttemptAt: row.activity.lastReengagementAttemptAt,
      },
    };
  }
}
