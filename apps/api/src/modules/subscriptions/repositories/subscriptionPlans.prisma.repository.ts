import type { Prisma, SubscriptionPlan, SubscriptionPlanEntitlement, SubscriptionPlanPerk, SubscriptionPlanPrice } from "../../../generated/prisma/client.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { EntitlementKey, EntitlementValue } from "../../../interfaces/entitlements.interface.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { VerificationColor, VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import type { BillingInterval, PlanChanges, PlanEntitlement, PlanPerk, PlanPrice, PlanRecord } from "../models/subscriptions.model.js";
import type { SubscriptionPlansRepository } from "./subscriptionPlans.repository.js";

type PlanRow = SubscriptionPlan & { prices: SubscriptionPlanPrice[]; entitlements: SubscriptionPlanEntitlement[]; perks: SubscriptionPlanPerk[] };

const withDetails = { prices: true, entitlements: true, perks: { orderBy: { sortOrder: "asc" as const } } } as const;

function convertPlanRowToRecord(row: PlanRow): PlanRecord {
  return {
    ...row,
    color: row.color as VerificationColor,
    tier: row.tier as VerificationTier,
    prices: row.prices.map((price) => ({ interval: price.interval as BillingInterval, currency: price.currency as CurrencyCode, amount: convertDatabaseAmountToMinorUnits(price.amount) })),
    entitlements: row.entitlements.map((entitlement) => ({ key: entitlement.key as EntitlementKey, value: entitlement.value as EntitlementValue })),
    perks: row.perks.map((perk) => ({ title: perk.title, description: perk.description })),
  };
}

export class PrismaSubscriptionPlansRepository implements SubscriptionPlansRepository {
  public async listPlans(color?: VerificationColor): Promise<readonly PlanRecord[]> {
    const rows = await prisma().subscriptionPlan.findMany({ where: color === undefined ? {} : { color }, include: withDetails, orderBy: { sortOrder: "asc" } });
    return rows.map(convertPlanRowToRecord);
  }

  public async findPlanById(planId: string): Promise<PlanRecord | undefined> {
    const row = await prisma().subscriptionPlan.findUnique({ where: { id: planId }, include: withDetails });
    return row === null ? undefined : convertPlanRowToRecord(row);
  }

  public async findPlanByColorAndTier(color: VerificationColor, tier: VerificationTier): Promise<PlanRecord | undefined> {
    const row = await prisma().subscriptionPlan.findUnique({ where: { color_tier: { color, tier } }, include: withDetails });
    return row === null ? undefined : convertPlanRowToRecord(row);
  }

  public async updatePlan(planId: string, changes: PlanChanges): Promise<PlanRecord | undefined> {
    if ((await prisma().subscriptionPlan.updateMany({ where: { id: planId }, data: changes })).count === 0) return undefined;
    return this.findPlanById(planId);
  }

  public async replacePrices(planId: string, prices: readonly PlanPrice[]): Promise<PlanRecord | undefined> {
    await prisma().$transaction([
      prisma().subscriptionPlanPrice.deleteMany({ where: { planId } }),
      prisma().subscriptionPlanPrice.createMany({ data: prices.map((price) => ({ planId, interval: price.interval, currency: price.currency, amount: BigInt(price.amount) })) }),
    ]);
    return this.findPlanById(planId);
  }

  public async replaceEntitlements(planId: string, entitlements: readonly PlanEntitlement[]): Promise<PlanRecord | undefined> {
    await prisma().$transaction([
      prisma().subscriptionPlanEntitlement.deleteMany({ where: { planId } }),
      prisma().subscriptionPlanEntitlement.createMany({ data: entitlements.map((entitlement) => ({ planId, key: entitlement.key, value: entitlement.value as Prisma.InputJsonValue })) }),
    ]);
    return this.findPlanById(planId);
  }

  public async replacePerks(planId: string, perks: readonly PlanPerk[]): Promise<PlanRecord | undefined> {
    await prisma().$transaction([
      prisma().subscriptionPlanPerk.deleteMany({ where: { planId } }),
      prisma().subscriptionPlanPerk.createMany({ data: perks.map((perk, sortOrder) => ({ planId, title: perk.title, description: perk.description, sortOrder })) }),
    ]);
    return this.findPlanById(planId);
  }
}
