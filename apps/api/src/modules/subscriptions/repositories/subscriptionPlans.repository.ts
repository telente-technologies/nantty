import type { VerificationColor, VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import type { PlanChanges, PlanEntitlement, PlanPerk, PlanPrice, PlanRecord } from "../models/subscriptions.model.js";
import { DEFAULT_SUBSCRIPTION_PLANS } from "../seeds/defaultPlans.seed.js";

export interface SubscriptionPlansRepository {
  listPlans(color?: VerificationColor): Promise<readonly PlanRecord[]>;
  findPlanById(planId: string): Promise<PlanRecord | undefined>;
  findPlanByColorAndTier(color: VerificationColor, tier: VerificationTier): Promise<PlanRecord | undefined>;
  updatePlan(planId: string, changes: PlanChanges): Promise<PlanRecord | undefined>;
  replacePrices(planId: string, prices: readonly PlanPrice[]): Promise<PlanRecord | undefined>;
  replaceEntitlements(planId: string, entitlements: readonly PlanEntitlement[]): Promise<PlanRecord | undefined>;
  replacePerks(planId: string, perks: readonly PlanPerk[]): Promise<PlanRecord | undefined>;
}

export class InMemorySubscriptionPlansRepository implements SubscriptionPlansRepository {
  private readonly plans = new Map<string, PlanRecord>(DEFAULT_SUBSCRIPTION_PLANS.map((plan) => [plan.id, structuredClone(plan)]));

  public async listPlans(color?: VerificationColor): Promise<readonly PlanRecord[]> {
    return [...this.plans.values()].filter((plan) => color === undefined || plan.color === color).sort((left, right) => left.sortOrder - right.sortOrder);
  }

  public async findPlanById(planId: string): Promise<PlanRecord | undefined> {
    return this.plans.get(planId);
  }

  public async findPlanByColorAndTier(color: VerificationColor, tier: VerificationTier): Promise<PlanRecord | undefined> {
    return [...this.plans.values()].find((plan) => plan.color === color && plan.tier === tier);
  }

  public async updatePlan(planId: string, changes: PlanChanges): Promise<PlanRecord | undefined> {
    return this.replace(planId, changes);
  }

  public async replacePrices(planId: string, prices: readonly PlanPrice[]): Promise<PlanRecord | undefined> {
    return this.replace(planId, { prices });
  }

  public async replaceEntitlements(planId: string, entitlements: readonly PlanEntitlement[]): Promise<PlanRecord | undefined> {
    return this.replace(planId, { entitlements });
  }

  public async replacePerks(planId: string, perks: readonly PlanPerk[]): Promise<PlanRecord | undefined> {
    return this.replace(planId, { perks });
  }

  private replace(planId: string, changes: Partial<PlanRecord>): PlanRecord | undefined {
    const plan = this.plans.get(planId);
    if (plan === undefined) return undefined;
    const updated: PlanRecord = { ...plan, ...changes };
    this.plans.set(planId, updated);
    return updated;
  }
}
