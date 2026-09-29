import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { AdBoostChanges, AdBoostRecord, BoostAudience, BoostGoal, BoostStatus, NewAdBoostInput } from "../models/adBoosts.model.js";
import type { AdBoostsRepository } from "./adBoosts.repository.js";

type BoostRow = Awaited<ReturnType<ReturnType<typeof prisma>["adBoost"]["create"]>>;

function toBoost(row: BoostRow): AdBoostRecord {
  return {
    ...row,
    goal: row.goal as BoostGoal,
    audience: row.audience as unknown as BoostAudience,
    dailyBudgetMinor: Number(row.dailyBudgetMinor),
    totalMinor: Number(row.totalMinor),
    currency: row.currency as CurrencyCode,
    status: row.status as BoostStatus,
  };
}

export class PrismaAdBoostsRepository implements AdBoostsRepository {
  public async createBoost(input: NewAdBoostInput, now: Date): Promise<AdBoostRecord> {
    const row = await prisma().adBoost.create({
      data: {
        ...input,
        audience: input.audience as unknown as Prisma.InputJsonValue,
        dailyBudgetMinor: BigInt(input.dailyBudgetMinor),
        totalMinor: BigInt(input.totalMinor),
        createdAt: now,
        updatedAt: now,
      },
    });
    return toBoost(row);
  }

  public async findBoost(boostId: string): Promise<AdBoostRecord | undefined> {
    const row = await prisma().adBoost.findUnique({ where: { id: boostId } });
    return row === null ? undefined : toBoost(row);
  }

  public async findBoostByCampaign(campaignId: string): Promise<AdBoostRecord | undefined> {
    const row = await prisma().adBoost.findFirst({ where: { campaignId } });
    return row === null ? undefined : toBoost(row);
  }

  public async updateBoost(boostId: string, changes: AdBoostChanges, now: Date): Promise<AdBoostRecord> {
    return toBoost(await prisma().adBoost.update({ where: { id: boostId }, data: { ...changes, updatedAt: now } }));
  }

  public async listBoostsEndedBefore(now: Date): Promise<readonly AdBoostRecord[]> {
    const rows = await prisma().adBoost.findMany({ where: { refundedAt: null, endsAt: { lte: now }, status: { in: ["active", "completed"] } }, take: 500 });
    return rows.map(toBoost);
  }
}
