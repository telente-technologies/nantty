import { randomUUID } from "node:crypto";

import type {
  AdCampaignChanges,
  AdCampaignRecord,
  AdChanges,
  AdRecord,
  AdSetChanges,
  AdSetRecord,
  DeliverableAd,
  NewAdCampaignInput,
  NewAdInput,
  NewAdSetInput,
} from "../models/adCampaigns.model.js";

export interface AdListFilter {
  readonly campaignId?: string;
  readonly adSetId?: string;
  readonly reviewStatus?: string;
}

export interface AdCampaignsRepository {
  createCampaign(input: NewAdCampaignInput, now: Date): Promise<AdCampaignRecord>;
  findCampaign(campaignId: string): Promise<AdCampaignRecord | undefined>;
  updateCampaign(campaignId: string, changes: AdCampaignChanges, now: Date): Promise<AdCampaignRecord>;
  deleteCampaignWithChildren(campaignId: string): Promise<void>;
  listCampaigns(accountId: string): Promise<readonly AdCampaignRecord[]>;
  createAdSet(input: NewAdSetInput, now: Date): Promise<AdSetRecord>;
  findAdSet(adSetId: string): Promise<AdSetRecord | undefined>;
  updateAdSet(adSetId: string, changes: AdSetChanges, now: Date): Promise<AdSetRecord>;
  listAdSets(accountId: string, campaignId?: string): Promise<readonly AdSetRecord[]>;
  createAd(input: NewAdInput, now: Date): Promise<AdRecord>;
  findAd(adId: string): Promise<AdRecord | undefined>;
  updateAd(adId: string, changes: AdChanges, now: Date): Promise<AdRecord>;
  listAds(accountId: string, filter: AdListFilter): Promise<readonly AdRecord[]>;
  listAdsAwaitingReview(limit: number): Promise<readonly AdRecord[]>;
  listDeliverableAds(): Promise<readonly DeliverableAd[]>;
}

export function isAdDeliverable(entry: DeliverableAd): boolean {
  return entry.campaign.status === "active" && entry.adSet.status === "active" && entry.ad.status === "active" && entry.ad.reviewStatus === "approved";
}

export class InMemoryAdCampaignsRepository implements AdCampaignsRepository {
  private readonly campaigns = new Map<string, AdCampaignRecord>();
  private readonly adSets = new Map<string, AdSetRecord>();
  private readonly ads = new Map<string, AdRecord>();

  public async createCampaign(input: NewAdCampaignInput, now: Date): Promise<AdCampaignRecord> {
    const campaign = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  public async findCampaign(campaignId: string): Promise<AdCampaignRecord | undefined> {
    return this.campaigns.get(campaignId);
  }

  public async updateCampaign(campaignId: string, changes: AdCampaignChanges, now: Date): Promise<AdCampaignRecord> {
    const updated = { ...this.require(this.campaigns, campaignId), ...changes, updatedAt: now };
    this.campaigns.set(campaignId, updated);
    return updated;
  }

  public async deleteCampaignWithChildren(campaignId: string): Promise<void> {
    this.campaigns.delete(campaignId);
    for (const adSet of [...this.adSets.values()]) if (adSet.campaignId === campaignId) this.adSets.delete(adSet.id);
    for (const ad of [...this.ads.values()]) if (ad.campaignId === campaignId) this.ads.delete(ad.id);
  }

  public async listCampaigns(accountId: string): Promise<readonly AdCampaignRecord[]> {
    return [...this.campaigns.values()].filter((campaign) => campaign.accountId === accountId).sort(compareNewestFirst);
  }

  public async createAdSet(input: NewAdSetInput, now: Date): Promise<AdSetRecord> {
    const adSet = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.adSets.set(adSet.id, adSet);
    return adSet;
  }

  public async findAdSet(adSetId: string): Promise<AdSetRecord | undefined> {
    return this.adSets.get(adSetId);
  }

  public async updateAdSet(adSetId: string, changes: AdSetChanges, now: Date): Promise<AdSetRecord> {
    const updated = { ...this.require(this.adSets, adSetId), ...changes, updatedAt: now };
    this.adSets.set(adSetId, updated);
    return updated;
  }

  public async listAdSets(accountId: string, campaignId?: string): Promise<readonly AdSetRecord[]> {
    return [...this.adSets.values()].filter((adSet) => adSet.accountId === accountId && (campaignId === undefined || adSet.campaignId === campaignId)).sort(compareNewestFirst);
  }

  public async createAd(input: NewAdInput, now: Date): Promise<AdRecord> {
    const ad = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.ads.set(ad.id, ad);
    return ad;
  }

  public async findAd(adId: string): Promise<AdRecord | undefined> {
    return this.ads.get(adId);
  }

  public async updateAd(adId: string, changes: AdChanges, now: Date): Promise<AdRecord> {
    const updated = { ...this.require(this.ads, adId), ...changes, updatedAt: now };
    this.ads.set(adId, updated);
    return updated;
  }

  public async listAds(accountId: string, filter: AdListFilter): Promise<readonly AdRecord[]> {
    return [...this.ads.values()]
      .filter(
        (ad) =>
          ad.accountId === accountId &&
          (filter.campaignId === undefined || ad.campaignId === filter.campaignId) &&
          (filter.adSetId === undefined || ad.adSetId === filter.adSetId) &&
          (filter.reviewStatus === undefined || ad.reviewStatus === filter.reviewStatus),
      )
      .sort(compareNewestFirst);
  }

  public async listAdsAwaitingReview(limit: number): Promise<readonly AdRecord[]> {
    return [...this.ads.values()]
      .filter((ad) => ad.reviewStatus === "pending" || ad.appeal?.status === "pending")
      .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
      .slice(0, limit);
  }

  public async listDeliverableAds(): Promise<readonly DeliverableAd[]> {
    return [...this.ads.values()].flatMap((ad) => {
      const campaign = this.campaigns.get(ad.campaignId);
      const adSet = this.adSets.get(ad.adSetId);
      if (campaign === undefined || adSet === undefined) return [];
      const entry = { campaign, adSet, ad };
      return isAdDeliverable(entry) ? [entry] : [];
    });
  }

  private require<T>(map: Map<string, T>, id: string): T {
    const record = map.get(id);
    if (record === undefined) throw new Error(`Ads record ${id} does not exist.`);
    return record;
  }
}

function compareNewestFirst(left: { readonly createdAt: Date; readonly id: string }, right: { readonly createdAt: Date; readonly id: string }): number {
  return right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id);
}
