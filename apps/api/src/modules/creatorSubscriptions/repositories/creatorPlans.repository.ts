import { randomUUID } from "node:crypto";

import type { CreatorPlanChange, CreatorPlanRecord, NewCreatorPlan } from "../models/creatorSubscriptions.model.js";

export interface CreatorPlansRepository {
  create(input: NewCreatorPlan): Promise<CreatorPlanRecord>;
  findById(planId: string): Promise<CreatorPlanRecord | undefined>;
  listForCreator(creatorId: string, includeInactive: boolean): Promise<readonly CreatorPlanRecord[]>;
  update(planId: string, change: CreatorPlanChange, updatedAt: Date): Promise<CreatorPlanRecord | undefined>;
}

export class InMemoryCreatorPlansRepository implements CreatorPlansRepository {
  private readonly plans = new Map<string, CreatorPlanRecord>();

  public async create(input: NewCreatorPlan): Promise<CreatorPlanRecord> {
    const plan = { ...input, id: randomUUID(), updatedAt: input.createdAt };
    this.plans.set(plan.id, plan);
    return plan;
  }

  public async findById(planId: string): Promise<CreatorPlanRecord | undefined> {
    return this.plans.get(planId);
  }

  public async listForCreator(creatorId: string, includeInactive: boolean): Promise<readonly CreatorPlanRecord[]> {
    return [...this.plans.values()]
      .filter((plan) => plan.creatorId === creatorId && (includeInactive || plan.active))
      .sort((left, right) => left.price - right.price || left.createdAt.getTime() - right.createdAt.getTime());
  }

  public async update(planId: string, change: CreatorPlanChange, updatedAt: Date): Promise<CreatorPlanRecord | undefined> {
    const plan = this.plans.get(planId);
    if (plan === undefined) return undefined;
    const updated = { ...plan, ...change, updatedAt };
    this.plans.set(planId, updated);
    return updated;
  }
}
