import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import { ENTITLEMENT_VALUE_TYPES } from "../../../interfaces/entitlements.interface.js";
import type { VerificationColor, VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import type { BillingInterval, PlanChanges, PlanEntitlement, PlanPerk, PlanPrice, PlanRecord } from "../models/subscriptions.model.js";
import type { SubscriptionPlansRepository } from "../repositories/subscriptionPlans.repository.js";

const FALLBACK_PRICE_CURRENCY: CurrencyCode = "USD";

export function choosePlanPrice(plan: PlanRecord, interval: BillingInterval, preferredCurrency: CurrencyCode): PlanPrice | undefined {
  const forInterval = plan.prices.filter((price) => price.interval === interval);
  return forInterval.find((price) => price.currency === preferredCurrency) ?? forInterval.find((price) => price.currency === FALLBACK_PRICE_CURRENCY) ?? forInterval[0];
}

function assertEntitlementValuesMatchTheirTypes(entitlements: readonly PlanEntitlement[]): void {
  for (const entitlement of entitlements) {
    const expected = ENTITLEMENT_VALUE_TYPES[entitlement.key];
    const actual = typeof entitlement.value === "string" ? "text" : typeof entitlement.value;
    if (expected !== actual) throw unprocessable(`The entitlement ${entitlement.key} needs a ${expected} value.`);
  }
  if (new Set(entitlements.map((entitlement) => entitlement.key)).size !== entitlements.length) throw unprocessable("Each entitlement can only appear once.");
}

export class SubscriptionPlansService {
  public constructor(private readonly plans: SubscriptionPlansRepository, private readonly audit: AuditRecorder) {}

  public async listPurchasablePlans(color: VerificationColor): Promise<readonly PlanRecord[]> {
    return (await this.plans.listPlans(color)).filter((plan) => plan.active && plan.purchasable);
  }

  public listAllPlans(): Promise<readonly PlanRecord[]> {
    return this.plans.listPlans();
  }

  public async findPurchasablePlanOrThrow(color: VerificationColor, tier: VerificationTier): Promise<PlanRecord> {
    const plan = await this.plans.findPlanByColorAndTier(color, tier);
    if (plan === undefined || !plan.active || !plan.purchasable) throw unprocessable("plan is not valid for this profile type");
    return plan;
  }

  public updatePlan(adminId: string, planId: string, changes: PlanChanges): Promise<PlanRecord> {
    return this.recordPlanChange(adminId, planId, "subscriptions.plan_updated", changes, () => this.plans.updatePlan(planId, changes));
  }

  public replacePrices(adminId: string, planId: string, prices: readonly PlanPrice[]): Promise<PlanRecord> {
    const keys = prices.map((price) => `${price.interval}:${price.currency}`);
    if (new Set(keys).size !== keys.length) throw unprocessable("Each interval and currency can only have one price.");
    return this.recordPlanChange(adminId, planId, "subscriptions.plan_prices_replaced", { prices }, () => this.plans.replacePrices(planId, prices));
  }

  public replaceEntitlements(adminId: string, planId: string, entitlements: readonly PlanEntitlement[]): Promise<PlanRecord> {
    assertEntitlementValuesMatchTheirTypes(entitlements);
    return this.recordPlanChange(adminId, planId, "subscriptions.plan_entitlements_replaced", { entitlements }, () => this.plans.replaceEntitlements(planId, entitlements));
  }

  public replacePerks(adminId: string, planId: string, perks: readonly PlanPerk[]): Promise<PlanRecord> {
    return this.recordPlanChange(adminId, planId, "subscriptions.plan_perks_replaced", { perks }, () => this.plans.replacePerks(planId, perks));
  }

  private async recordPlanChange(adminId: string, planId: string, action: string, metadata: Record<string, unknown>, change: () => Promise<PlanRecord | undefined>): Promise<PlanRecord> {
    const previous = await this.plans.findPlanById(planId);
    if (previous === undefined) throw notFound("Plan");
    const updated = await change();
    if (updated === undefined) throw notFound("Plan");
    await this.audit.record({ actorId: adminId, action, entityType: "subscription_plan", entityId: planId, metadata: { color: updated.color, tier: updated.tier, ...metadata } });
    return updated;
  }
}
