import { randomUUID } from "node:crypto";

import { buildAffiliateTargetKey, type AffiliateCommissionRecord, type CreatorAffiliationRecord } from "../models/creators.model.js";

export interface AffiliateCommissionChange {
  readonly storeId: string;
  readonly productId: string | null;
  readonly commissionBps: number;
  readonly updatedById: string;
  readonly updatedAt: Date;
}

export interface AffiliatesRepository {
  saveCommission(change: AffiliateCommissionChange): Promise<AffiliateCommissionRecord>;
  removeCommission(storeId: string, productId: string | null): Promise<boolean>;
  listCommissionsForStore(storeId: string): Promise<readonly AffiliateCommissionRecord[]>;
  findApplicableCommission(storeId: string, productId: string): Promise<AffiliateCommissionRecord | undefined>;
  addAffiliation(affiliation: CreatorAffiliationRecord): Promise<boolean>;
  removeAffiliation(creatorId: string, storeId: string, productId: string | null): Promise<boolean>;
  listAffiliations(creatorId: string): Promise<readonly CreatorAffiliationRecord[]>;
}

export class InMemoryAffiliatesRepository implements AffiliatesRepository {
  private readonly commissions = new Map<string, AffiliateCommissionRecord>();
  private readonly affiliations = new Map<string, CreatorAffiliationRecord>();

  public async saveCommission(change: AffiliateCommissionChange): Promise<AffiliateCommissionRecord> {
    const key = buildAffiliateTargetKey(change.storeId, change.productId);
    const saved = { ...change, id: this.commissions.get(key)?.id ?? randomUUID() };
    this.commissions.set(key, saved);
    return saved;
  }

  public async removeCommission(storeId: string, productId: string | null): Promise<boolean> {
    const key = buildAffiliateTargetKey(storeId, productId);
    const existing = this.commissions.get(key);
    return existing !== undefined && existing.storeId === storeId && this.commissions.delete(key);
  }

  public async listCommissionsForStore(storeId: string): Promise<readonly AffiliateCommissionRecord[]> {
    return [...this.commissions.values()].filter((commission) => commission.storeId === storeId);
  }

  public async findApplicableCommission(storeId: string, productId: string): Promise<AffiliateCommissionRecord | undefined> {
    const productLevel = this.commissions.get(buildAffiliateTargetKey(storeId, productId));
    return productLevel?.storeId === storeId ? productLevel : this.commissions.get(buildAffiliateTargetKey(storeId, null));
  }

  public async addAffiliation(affiliation: CreatorAffiliationRecord): Promise<boolean> {
    const key = `${affiliation.creatorId}:${buildAffiliateTargetKey(affiliation.storeId, affiliation.productId)}`;
    if (this.affiliations.has(key)) return false;
    this.affiliations.set(key, affiliation);
    return true;
  }

  public async removeAffiliation(creatorId: string, storeId: string, productId: string | null): Promise<boolean> {
    return this.affiliations.delete(`${creatorId}:${buildAffiliateTargetKey(storeId, productId)}`);
  }

  public async listAffiliations(creatorId: string): Promise<readonly CreatorAffiliationRecord[]> {
    return [...this.affiliations.values()].filter((affiliation) => affiliation.creatorId === creatorId).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}
