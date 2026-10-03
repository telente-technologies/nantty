import type { PrismaClient } from "../../../databases/prisma.database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { CampaignRepository } from "../../../interfaces/campaignRepository.interface.js";
import type { BatchProgress, Campaign, CampaignKind, NewCampaign } from "../../../types/campaign.type.js";

type Row = Awaited<ReturnType<PrismaClient["bulkCampaign"]["findFirstOrThrow"]>>;

function convertRow(row: Row): Campaign {
  return { ...row, kind: row.kind as Campaign["kind"], status: row.status as Campaign["status"], payload: row.payload as unknown as Campaign["payload"], audienceKind: row.audienceKind as Campaign["audienceKind"], mailKind: row.mailKind as Campaign["mailKind"] };
}

export class CampaignPrismaRepository implements CampaignRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async create(campaign: NewCampaign): Promise<Campaign> {
    return convertRow(await this.prisma.bulkCampaign.create({ data: { ...campaign, status: "QUEUED", payload: campaign.payload as unknown as Prisma.InputJsonValue } }));
  }

  public async findById(id: string): Promise<Campaign | null> {
    const row = await this.prisma.bulkCampaign.findUnique({ where: { id } });
    return row === null ? null : convertRow(row);
  }

  public async list(kind: CampaignKind, limit: number): Promise<readonly Campaign[]> {
    return (await this.prisma.bulkCampaign.findMany({ where: { kind }, orderBy: { createdAt: "desc" }, take: limit })).map(convertRow);
  }

  public async findActiveForVersion(versionId: string): Promise<Campaign | null> {
    const row = await this.prisma.bulkCampaign.findFirst({ where: { versionId, status: { in: ["QUEUED", "SENDING"] } } });
    return row === null ? null : convertRow(row);
  }

  public async applyBatchProgress(id: string, expectedBatchesDone: number, progress: BatchProgress, completedAt: Date | null): Promise<boolean> {
    const result = await this.prisma.bulkCampaign.updateMany({
      where: { id, batchesDone: expectedBatchesDone },
      data: {
        sentCount: { increment: progress.sentCount }, failedCount: { increment: progress.failedCount }, batchesDone: { increment: 1 },
        nextCursor: progress.nextCursor, status: completedAt === null ? "SENDING" : "COMPLETED", completedAt,
      },
    });
    return result.count === 1;
  }
}
