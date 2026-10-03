import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { SuppressionReason, SuppressionRepository } from "../../../interfaces/repositories.interface.js";

export class SuppressionPrismaRepository implements SuppressionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async find(email: string): Promise<SuppressionReason | null> {
    const row = await this.prisma.emailSuppression.findUnique({ where: { email: email.toLowerCase() } });
    return (row?.reason as SuppressionReason | undefined) ?? null;
  }

  public async upsert(email: string, reason: SuppressionReason, source: string): Promise<void> {
    const key = email.toLowerCase();
    const existing = await this.prisma.emailSuppression.findUnique({ where: { email: key } });
    if (existing?.reason === "hard_bounce" && reason !== "hard_bounce") return;
    await this.prisma.emailSuppression.upsert({ where: { email: key }, create: { email: key, reason, source }, update: { reason, source } });
  }

  public async countByReason(): Promise<Readonly<Record<SuppressionReason, number>>> {
    const groups = await this.prisma.emailSuppression.groupBy({ by: ["reason"], _count: { _all: true } });
    const counts: Record<SuppressionReason, number> = { hard_bounce: 0, complaint: 0, manual: 0 };
    for (const group of groups) if (group.reason in counts) counts[group.reason as SuppressionReason] = group._count._all;
    return counts;
  }
}
