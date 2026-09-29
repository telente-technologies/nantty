import { randomUUID } from "node:crypto";

import type { AdBoostChanges, AdBoostRecord, NewAdBoostInput } from "../models/adBoosts.model.js";

export interface AdBoostsRepository {
  createBoost(input: NewAdBoostInput, now: Date): Promise<AdBoostRecord>;
  findBoost(boostId: string): Promise<AdBoostRecord | undefined>;
  findBoostByCampaign(campaignId: string): Promise<AdBoostRecord | undefined>;
  updateBoost(boostId: string, changes: AdBoostChanges, now: Date): Promise<AdBoostRecord>;
  listBoostsEndedBefore(now: Date): Promise<readonly AdBoostRecord[]>;
}

export class InMemoryAdBoostsRepository implements AdBoostsRepository {
  private readonly boosts = new Map<string, AdBoostRecord>();

  public async createBoost(input: NewAdBoostInput, now: Date): Promise<AdBoostRecord> {
    const boost = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.boosts.set(boost.id, boost);
    return boost;
  }

  public async findBoost(boostId: string): Promise<AdBoostRecord | undefined> {
    return this.boosts.get(boostId);
  }

  public async findBoostByCampaign(campaignId: string): Promise<AdBoostRecord | undefined> {
    return [...this.boosts.values()].find((boost) => boost.campaignId === campaignId);
  }

  public async updateBoost(boostId: string, changes: AdBoostChanges, now: Date): Promise<AdBoostRecord> {
    const boost = this.boosts.get(boostId);
    if (boost === undefined) throw new Error(`Boost ${boostId} does not exist.`);
    const updated = { ...boost, ...changes, updatedAt: now };
    this.boosts.set(boostId, updated);
    return updated;
  }

  public async listBoostsEndedBefore(now: Date): Promise<readonly AdBoostRecord[]> {
    return [...this.boosts.values()].filter((boost) => boost.refundedAt === null && boost.endsAt !== null && boost.endsAt <= now && (boost.status === "active" || boost.status === "completed"));
  }
}
