import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { LoyaltyReward, PointsRedemption } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { LoyaltyRewardKind, LoyaltyRewardRecord, NewLoyaltyReward, PointsRedemptionRecord, PointsRedemptionStatus } from "../models/loyalty.model.js";
import type { LoyaltyRewardsRepository } from "./loyaltyRewards.repository.js";

function convertRewardRow(row: LoyaltyReward): LoyaltyRewardRecord {
  return { ...row, kind: row.kind as LoyaltyRewardKind, amount: convertDatabaseAmountToMinorUnits(row.amount), currency: row.currency as CurrencyCode | null };
}

function convertRedemptionRow(row: PointsRedemption): PointsRedemptionRecord {
  return { ...row, discount: convertDatabaseAmountToMinorUnits(row.discount), currency: row.currency as CurrencyCode, status: row.status as PointsRedemptionStatus };
}

export class PrismaLoyaltyRewardsRepository implements LoyaltyRewardsRepository {
  public async recordRewardIfNew(reward: NewLoyaltyReward): Promise<{ readonly reward: LoyaltyRewardRecord; readonly created: boolean }> {
    try {
      return { reward: convertRewardRow(await prisma().loyaltyReward.create({ data: { ...reward, amount: BigInt(reward.amount) } })), created: true };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      return { reward: convertRewardRow(await prisma().loyaltyReward.findUniqueOrThrow({ where: { reference: reward.reference } })), created: false };
    }
  }

  public async listRewards(userId: string, page: PageRequest): Promise<Page<LoyaltyRewardRecord>> {
    const rows = await prisma().loyaltyReward.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...buildPrismaPageArguments(page) });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertRewardRow);
  }

  public async listRewardsOfKind(userId: string, kind: LoyaltyRewardKind): Promise<readonly LoyaltyRewardRecord[]> {
    return (await prisma().loyaltyReward.findMany({ where: { userId, kind } })).map(convertRewardRow);
  }

  public async sumPointsEarned(userId: string): Promise<number> {
    return (await prisma().loyaltyReward.aggregate({ where: { userId, kind: "points_earned" }, _sum: { points: true } }))._sum.points ?? 0;
  }

  public async createRedemption(redemption: PointsRedemptionRecord): Promise<boolean> {
    try {
      await prisma().pointsRedemption.create({ data: { ...redemption, discount: BigInt(redemption.discount) } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async findRedemption(checkoutId: string): Promise<PointsRedemptionRecord | undefined> {
    const row = await prisma().pointsRedemption.findUnique({ where: { checkoutId } });
    return row === null ? undefined : convertRedemptionRow(row);
  }

  public async changeRedemptionStatus(checkoutId: string, from: PointsRedemptionStatus, to: PointsRedemptionStatus): Promise<boolean> {
    return (await prisma().pointsRedemption.updateMany({ where: { checkoutId, status: from }, data: { status: to } })).count === 1;
  }
}
