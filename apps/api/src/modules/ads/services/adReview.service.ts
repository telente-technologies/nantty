import type { AdCampaignRecord, AdPolicyCategoryRecord, AdRecord, AutoCheckFlag, DeliveryStatus, PolicySeverity, ResolvedCreative } from "../models/adCampaigns.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";

interface PolicyDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: PolicySeverity;
  readonly keywords: readonly string[];
}

export const DEFAULT_POLICY_CATEGORIES: readonly PolicyDefinition[] = [
  { id: "illegal_products", name: "Illegal products and services", description: "Anything illegal in the country where the ad is shown.", severity: "CRITICAL", keywords: ["stolen", "fake certificate", "fake documents", "unlicensed drugs"] },
  { id: "weapons", name: "Weapons and explosives", description: "Firearms, ammunition, explosives and parts for them.", severity: "CRITICAL", keywords: ["gun for sale", "ammunition", "rifle", "pistol", "explosive"] },
  { id: "tobacco_vaping", name: "Tobacco, vaping and recreational drugs", description: "Cigarettes, vapes, shisha and drug paraphernalia.", severity: "HIGH", keywords: ["vape", "e-cigarette", "shisha", "cigarette"] },
  { id: "adult_content", name: "Adult content and services", description: "Nudity, sexual services and suggestive imagery.", severity: "CRITICAL", keywords: ["escort", "xxx", "nude"] },
  { id: "financial_scams", name: "Deceptive financial products", description: "Get-rich-quick offers, ponzi schemes and unregistered investments.", severity: "CRITICAL", keywords: ["double your money", "guaranteed returns", "get rich quick", "ponzi"] },
  { id: "counterfeit", name: "Counterfeit goods", description: "Replicas or fakes of branded products.", severity: "HIGH", keywords: ["replica", "first copy", "fake designer", "master copy"] },
  { id: "misleading_claims", name: "Misleading claims", description: "Before-and-after health claims, miracle cures, fake scarcity or fake reviews.", severity: "HIGH", keywords: ["miracle cure", "cures diabetes", "cures cancer", "lose 10kg"] },
  { id: "gambling", name: "Gambling without authorisation", description: "Betting, lotteries and casinos need written approval and a valid licence.", severity: "HIGH", keywords: ["betting", "casino", "jackpot"] },
  { id: "discrimination", name: "Discrimination and hate", description: "Ads that target or exclude people by protected traits in a harmful way.", severity: "CRITICAL", keywords: [] },
  { id: "personal_attributes", name: "Personal attributes", description: "Text that implies you know someone's health, finances, religion or other private traits.", severity: "MEDIUM", keywords: ["are you hiv", "struggling with your debts"] },
];

export function runAutomatedPolicyChecks(creative: ResolvedCreative): AutoCheckFlag[] {
  const text = `${creative.headline} ${creative.primaryText} ${creative.product?.title ?? ""}`.toLowerCase();
  return DEFAULT_POLICY_CATEGORIES.flatMap((policy) => {
    const matched = policy.keywords.find((keyword) => text.includes(keyword));
    return matched === undefined ? [] : [{ policyCategoryId: policy.id, label: policy.name, severity: policy.severity, detail: `The ad text mentions "${matched}".` }];
  });
}

export function deriveParentStatus(current: DeliveryStatus, children: readonly { readonly status: DeliveryStatus }[]): DeliveryStatus {
  if (current === "paused" || current === "completed") return current;
  if (children.some((child) => child.status === "active" || child.status === "paused")) return "active";
  if (children.length > 0 && children.every((child) => child.status === "rejected")) return "rejected";
  if (children.some((child) => child.status === "in_review")) return "in_review";
  return current === "active" ? "active" : "draft";
}

export class AdReviewService {
  public constructor(private readonly dependencies: AdsDependencies) {}

  public async ensureDefaultPolicyCategories(): Promise<readonly AdPolicyCategoryRecord[]> {
    const { policies, clock } = this.dependencies;
    const existing = await policies.listCategories();
    if (existing.length > 0) return existing;
    for (const policy of DEFAULT_POLICY_CATEGORIES) {
      await policies.createCategory({ id: policy.id, name: policy.name, description: policy.description, severity: policy.severity, isActive: true }, clock.now());
    }
    return policies.listCategories();
  }

  public async submitAdForReview(ad: AdRecord): Promise<AdRecord> {
    const now = this.dependencies.clock.now();
    return this.dependencies.campaigns.updateAd(
      ad.id,
      { status: "in_review", reviewStatus: "pending", policyCode: null, policyReason: null, reviewedAt: null, reviewedById: null, autoCheckFlags: runAutomatedPolicyChecks(ad.creative), submittedAt: now },
      now,
    );
  }

  public async recomputeCampaignStatuses(campaignId: string): Promise<AdCampaignRecord | undefined> {
    const { campaigns, clock } = this.dependencies;
    const campaign = await campaigns.findCampaign(campaignId);
    if (campaign === undefined) return undefined;
    const adSets = await campaigns.listAdSets(campaign.accountId, campaignId);
    const ads = await campaigns.listAds(campaign.accountId, { campaignId });
    for (const adSet of adSets) {
      const next = deriveParentStatus(adSet.status, ads.filter((ad) => ad.adSetId === adSet.id));
      if (next !== adSet.status) await campaigns.updateAdSet(adSet.id, { status: next }, clock.now());
    }
    const nextCampaignStatus = deriveParentStatus(campaign.status, ads);
    return nextCampaignStatus === campaign.status ? campaign : campaigns.updateCampaign(campaignId, { status: nextCampaignStatus }, clock.now());
  }
}
