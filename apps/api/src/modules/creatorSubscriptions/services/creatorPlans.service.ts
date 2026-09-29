import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { notFound } from "../../../errors/domain.error.js";
import { hasSubscriberAccess, type CreatorPlanChange, type CreatorPlanInterval, type PlanBenefit } from "../models/creatorSubscriptions.model.js";
import { presentCreatorPlan, presentCreatorSubscriber, type CreatorPlanDto, type CreatorSubscriberDto } from "../dtos/creatorSubscriptions.dto.js";
import type { CreatorSubscriptionBillingService } from "./creatorSubscriptionBilling.service.js";

export type BenefitInput = string | { readonly name: string; readonly description?: string | undefined };

export interface NewCreatorPlanInput {
  readonly name: string;
  readonly description?: string | undefined;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly interval: CreatorPlanInterval;
  readonly benefits: readonly BenefitInput[];
}

export interface CreatorPlanUpdateInput {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly benefits?: readonly BenefitInput[] | undefined;
  readonly active?: boolean | undefined;
}

export function normalizeBenefits(benefits: readonly BenefitInput[]): PlanBenefit[] {
  return benefits.map((benefit) => (typeof benefit === "string" ? { name: benefit, description: "" } : { name: benefit.name, description: benefit.description ?? "" }));
}

export class CreatorPlansService {
  public constructor(private readonly billing: CreatorSubscriptionBillingService) {}

  public async createPlan(creatorId: string, input: NewCreatorPlanInput): Promise<CreatorPlanDto> {
    const { plans, creatorAccess, audit, clock } = this.billing.dependencies;
    await creatorAccess.assertApprovedCreator(creatorId);
    const plan = await plans.create({
      creatorId, name: input.name, description: input.description ?? "", price: input.amountMinor, currency: input.currency, interval: input.interval,
      benefits: normalizeBenefits(input.benefits), active: true, createdAt: clock.now(),
    });
    await audit.record({ actorId: creatorId, action: "creator_subscriptions.plan_created", entityType: "creator_subscription_plan", entityId: plan.id, metadata: { price: plan.price, currency: plan.currency } });
    return presentCreatorPlan(plan, 0);
  }

  public async updatePlan(creatorId: string, planId: string, input: CreatorPlanUpdateInput): Promise<CreatorPlanDto> {
    const { plans, audit, clock } = this.billing.dependencies;
    const plan = await plans.findById(planId);
    if (plan === undefined || plan.creatorId !== creatorId) throw notFound("Subscription plan");
    const change: CreatorPlanChange = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.benefits === undefined ? {} : { benefits: normalizeBenefits(input.benefits) }),
      ...(input.active === undefined ? {} : { active: input.active }),
    };
    const updated = (await plans.update(planId, change, clock.now())) ?? plan;
    await audit.record({ actorId: creatorId, action: "creator_subscriptions.plan_updated", entityType: "creator_subscription_plan", entityId: planId, metadata: { change } });
    return (await this.presentPlansWithCounts(creatorId, [updated]))[0] as CreatorPlanDto;
  }

  public async listPlans(creatorId: string, includeInactive: boolean): Promise<readonly CreatorPlanDto[]> {
    return this.presentPlansWithCounts(creatorId, await this.billing.dependencies.plans.listForCreator(creatorId, includeInactive));
  }

  public async listSubscribers(creatorId: string): Promise<readonly CreatorSubscriberDto[]> {
    const { subscriptions, userDirectory, plans, clock } = this.billing.dependencies;
    const now = clock.now();
    const active = (await subscriptions.listForCreator(creatorId, ["active", "past_due", "cancelled"])).filter((item) => hasSubscriberAccess(item, now));
    const users = new Map((active.length === 0 ? [] : await userDirectory.findUserSummaries(active.map((item) => item.subscriberId))).map((user) => [user.id, user]));
    const planNames = new Map((await plans.listForCreator(creatorId, true)).map((plan) => [plan.id, plan.name]));
    return active.map((item) => presentCreatorSubscriber(item, users.get(item.subscriberId), planNames.get(item.planId) ?? ""));
  }

  private async presentPlansWithCounts(creatorId: string, planRecords: readonly Parameters<typeof presentCreatorPlan>[0][]): Promise<CreatorPlanDto[]> {
    const { subscriptions, clock } = this.billing.dependencies;
    const now = clock.now();
    const active = (await subscriptions.listForCreator(creatorId, ["active", "past_due", "cancelled"])).filter((item) => hasSubscriberAccess(item, now));
    return planRecords.map((plan) => presentCreatorPlan(plan, active.filter((item) => item.planId === plan.id).length));
  }
}
