import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { AdPolicyCategoryRecord, PolicySeverity } from "../models/adCampaigns.model.js";
import type { AdPoliciesRepository, AdPolicyCategoryChanges, NewAdPolicyCategoryInput } from "./adPolicies.repository.js";

type CategoryRow = Awaited<ReturnType<ReturnType<typeof prisma>["adPolicyCategory"]["create"]>>;

function toCategory(row: CategoryRow): AdPolicyCategoryRecord {
  return { ...row, severity: row.severity as PolicySeverity };
}

export class PrismaAdPoliciesRepository implements AdPoliciesRepository {
  public async listCategories(): Promise<readonly AdPolicyCategoryRecord[]> {
    return (await prisma().adPolicyCategory.findMany({ orderBy: { name: "asc" } })).map(toCategory);
  }

  public async findCategory(id: string): Promise<AdPolicyCategoryRecord | undefined> {
    const row = await prisma().adPolicyCategory.findUnique({ where: { id } });
    return row === null ? undefined : toCategory(row);
  }

  public async createCategory(input: NewAdPolicyCategoryInput, now: Date): Promise<AdPolicyCategoryRecord | undefined> {
    try {
      return toCategory(await prisma().adPolicyCategory.create({ data: { ...input, createdAt: now, updatedAt: now } }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return undefined;
      throw error;
    }
  }

  public async updateCategory(id: string, changes: AdPolicyCategoryChanges, now: Date): Promise<AdPolicyCategoryRecord> {
    return toCategory(await prisma().adPolicyCategory.update({ where: { id }, data: { ...changes, updatedAt: now } }));
  }

  public async incrementRejections(id: string): Promise<void> {
    await prisma().adPolicyCategory.updateMany({ where: { id }, data: { rejectionCount: { increment: 1 } } });
  }
}
