import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { CreatorSubscriptionPlan } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import type { CreatorPlanChange, CreatorPlanInterval, CreatorPlanRecord, NewCreatorPlan, PlanBenefit } from "../models/creatorSubscriptions.model.js";
import type { CreatorPlansRepository } from "./creatorPlans.repository.js";

function convertPlanRow(row: CreatorSubscriptionPlan): CreatorPlanRecord {
  return {
    ...row,
    price: convertDatabaseAmountToMinorUnits(row.price),
    currency: row.currency as CurrencyCode,
    interval: row.interval as CreatorPlanInterval,
    benefits: (Array.isArray(row.benefits) ? row.benefits : []) as unknown as PlanBenefit[],
  };
}

function convertBenefits(benefits: readonly PlanBenefit[]) {
  return benefits.map((benefit) => ({ name: benefit.name, description: benefit.description }));
}

export class PrismaCreatorPlansRepository implements CreatorPlansRepository {
  public async create(input: NewCreatorPlan): Promise<CreatorPlanRecord> {
    return convertPlanRow(await prisma().creatorSubscriptionPlan.create({ data: { ...input, price: BigInt(input.price), benefits: convertBenefits(input.benefits) } }));
  }

  public async findById(planId: string): Promise<CreatorPlanRecord | undefined> {
    const row = await prisma().creatorSubscriptionPlan.findUnique({ where: { id: planId } });
    return row === null ? undefined : convertPlanRow(row);
  }

  public async listForCreator(creatorId: string, includeInactive: boolean): Promise<readonly CreatorPlanRecord[]> {
    const rows = await prisma().creatorSubscriptionPlan.findMany({
      where: { creatorId, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ price: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(convertPlanRow);
  }

  public async update(planId: string, change: CreatorPlanChange, updatedAt: Date): Promise<CreatorPlanRecord | undefined> {
    const { benefits, ...rest } = change;
    const result = await prisma().creatorSubscriptionPlan.updateMany({
      where: { id: planId },
      data: { ...rest, ...(benefits === undefined ? {} : { benefits: convertBenefits(benefits) }), updatedAt },
    });
    return result.count === 0 ? undefined : this.findById(planId);
  }
}
