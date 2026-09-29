import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import { prisma } from "../../../integrations/database.integration.js";
import { buildAffiliateTargetKey, type AffiliateCommissionRecord, type CreatorAffiliationRecord } from "../models/creators.model.js";
import type { AffiliateCommissionChange, AffiliatesRepository } from "./affiliates.repository.js";

const COMMISSION_FIELDS = { id: true, storeId: true, productId: true, commissionBps: true, updatedById: true, updatedAt: true } as const;
const AFFILIATION_FIELDS = { creatorId: true, storeId: true, productId: true, createdAt: true } as const;

export class PrismaAffiliatesRepository implements AffiliatesRepository {
  public async saveCommission(change: AffiliateCommissionChange): Promise<AffiliateCommissionRecord> {
    const targetKey = buildAffiliateTargetKey(change.storeId, change.productId);
    return prisma().affiliateCommission.upsert({
      where: { targetKey },
      create: { ...change, targetKey },
      update: { commissionBps: change.commissionBps, updatedById: change.updatedById, updatedAt: change.updatedAt },
      select: COMMISSION_FIELDS,
    });
  }

  public async removeCommission(storeId: string, productId: string | null): Promise<boolean> {
    return (await prisma().affiliateCommission.deleteMany({ where: { storeId, targetKey: buildAffiliateTargetKey(storeId, productId) } })).count > 0;
  }

  public async listCommissionsForStore(storeId: string): Promise<readonly AffiliateCommissionRecord[]> {
    return prisma().affiliateCommission.findMany({ where: { storeId }, orderBy: { createdAt: "asc" }, select: COMMISSION_FIELDS });
  }

  public async findApplicableCommission(storeId: string, productId: string): Promise<AffiliateCommissionRecord | undefined> {
    const rows = await prisma().affiliateCommission.findMany({
      where: { storeId, targetKey: { in: [buildAffiliateTargetKey(storeId, productId), buildAffiliateTargetKey(storeId, null)] } },
      select: COMMISSION_FIELDS,
    });
    return rows.find((row) => row.productId === productId) ?? rows.find((row) => row.productId === null);
  }

  public async addAffiliation(affiliation: CreatorAffiliationRecord): Promise<boolean> {
    try {
      await prisma().creatorAffiliation.create({ data: { ...affiliation, targetKey: buildAffiliateTargetKey(affiliation.storeId, affiliation.productId) } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async removeAffiliation(creatorId: string, storeId: string, productId: string | null): Promise<boolean> {
    return (await prisma().creatorAffiliation.deleteMany({ where: { creatorId, targetKey: buildAffiliateTargetKey(storeId, productId) } })).count > 0;
  }

  public async listAffiliations(creatorId: string): Promise<readonly CreatorAffiliationRecord[]> {
    return prisma().creatorAffiliation.findMany({ where: { creatorId }, orderBy: { createdAt: "desc" }, select: AFFILIATION_FIELDS });
  }
}
