import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { Referral } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { NewReferral, ReferralRecord, ReferralStatus } from "../models/loyalty.model.js";
import type { ReferralRewardChange, ReferralsRepository } from "./referrals.repository.js";

function convertReferralRow(row: Referral): ReferralRecord {
  return {
    ...row,
    status: row.status as ReferralStatus,
    rewardAmount: row.rewardAmount === null ? null : Number(row.rewardAmount),
    rewardCurrency: row.rewardCurrency as CurrencyCode | null,
  };
}

export class PrismaReferralsRepository implements ReferralsRepository {
  public async findCodeForUser(userId: string): Promise<string | undefined> {
    return (await prisma().referralCode.findUnique({ where: { userId } }))?.code;
  }

  public async findUserIdForCode(code: string): Promise<string | undefined> {
    return (await prisma().referralCode.findUnique({ where: { code } }))?.userId;
  }

  public async saveCodeIfFree(userId: string, code: string): Promise<boolean> {
    try {
      await prisma().referralCode.create({ data: { userId, code } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async createReferral(input: NewReferral): Promise<ReferralRecord | undefined> {
    try {
      return convertReferralRow(await prisma().referral.create({ data: { ...input, updatedAt: input.createdAt } }));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return undefined;
      throw error;
    }
  }

  public async findReferralForReferee(refereeId: string): Promise<ReferralRecord | undefined> {
    const row = await prisma().referral.findUnique({ where: { refereeId } });
    return row === null ? undefined : convertReferralRow(row);
  }

  public async listReferralsForReferrer(referrerId: string): Promise<readonly ReferralRecord[]> {
    return (await prisma().referral.findMany({ where: { referrerId }, orderBy: { createdAt: "desc" }, take: 200 })).map(convertReferralRow);
  }

  public async countReferralsSince(referrerId: string, since: Date): Promise<number> {
    return prisma().referral.count({ where: { referrerId, createdAt: { gte: since } } });
  }

  public async markRewarded(referralId: string, from: ReferralStatus, change: ReferralRewardChange): Promise<boolean> {
    const result = await prisma().referral.updateMany({ where: { id: referralId, status: from }, data: { ...change, rewardAmount: BigInt(change.rewardAmount), status: "rewarded" } });
    return result.count === 1;
  }
}
