import { prisma } from "../../../integrations/database.integration.js";
import type { ProductEngagementKind, ProductEngagementRepository } from "./productEngagement.repository.js";

export class PrismaProductEngagementRepository implements ProductEngagementRepository {
  public async add(kind: ProductEngagementKind, productId: string, userId: string): Promise<void> {
    const key = { productId_userId: { productId, userId } };
    if (kind === "like") {
      await prisma().productLike.upsert({ where: key, create: { productId, userId }, update: {} });
    } else {
      await prisma().productBookmark.upsert({ where: key, create: { productId, userId }, update: {} });
    }
  }

  public async remove(kind: ProductEngagementKind, productId: string, userId: string): Promise<void> {
    if (kind === "like") {
      await prisma().productLike.deleteMany({ where: { productId, userId } });
    } else {
      await prisma().productBookmark.deleteMany({ where: { productId, userId } });
    }
  }

  public async listEngagedProductIds(kind: ProductEngagementKind, userId: string, productIds: readonly string[]): Promise<ReadonlySet<string>> {
    const where = { userId, productId: { in: [...productIds] } };
    const rows = kind === "like"
      ? await prisma().productLike.findMany({ where, select: { productId: true } })
      : await prisma().productBookmark.findMany({ where, select: { productId: true } });
    return new Set(rows.map((row) => row.productId));
  }

  public countForProduct(kind: ProductEngagementKind, productId: string): Promise<number> {
    return kind === "like" ? prisma().productLike.count({ where: { productId } }) : prisma().productBookmark.count({ where: { productId } });
  }
}
