import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
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
import { isAdDeliverable, type AdCampaignsRepository, type AdListFilter } from "./adCampaigns.repository.js";

type CampaignRow = Awaited<ReturnType<ReturnType<typeof prisma>["adCampaign"]["create"]>>;
type AdSetRow = Awaited<ReturnType<ReturnType<typeof prisma>["adSet"]["create"]>>;
type AdRow = Awaited<ReturnType<ReturnType<typeof prisma>["ad"]["create"]>>;

const toNumberOrNull = (value: bigint | null): number | null => (value === null ? null : Number(value));
const toBigIntOrNull = (value: number | null | undefined): bigint | null | undefined => (value === undefined ? undefined : value === null ? null : BigInt(value));
const toJson = (value: unknown) => value as Prisma.InputJsonValue;

function toCampaign(row: CampaignRow): AdCampaignRecord {
  return {
    ...row,
    objective: row.objective as AdCampaignRecord["objective"],
    status: row.status as AdCampaignRecord["status"],
    budgetLevel: row.budgetLevel as AdCampaignRecord["budgetLevel"],
    budgetType: row.budgetType as AdCampaignRecord["budgetType"],
    budgetMinor: toNumberOrNull(row.budgetMinor),
    spendCapMinor: toNumberOrNull(row.spendCapMinor),
    currency: row.currency as CurrencyCode,
    origin: row.origin as AdCampaignRecord["origin"],
  };
}

function toAdSet(row: AdSetRow): AdSetRecord {
  return {
    ...row,
    status: row.status as AdSetRecord["status"],
    audience: row.audience as unknown as AdSetRecord["audience"],
    placementMode: row.placementMode as AdSetRecord["placementMode"],
    placements: row.placements as AdSetRecord["placements"],
    budgetType: row.budgetType as AdSetRecord["budgetType"],
    budgetMinor: toNumberOrNull(row.budgetMinor),
    bidType: row.bidType as AdSetRecord["bidType"],
    bidMinor: toNumberOrNull(row.bidMinor),
  };
}

function toAd(row: AdRow): AdRecord {
  return {
    ...row,
    status: row.status as AdRecord["status"],
    reviewStatus: row.reviewStatus as AdRecord["reviewStatus"],
    appeal: row.appeal as unknown as AdRecord["appeal"],
    autoCheckFlags: row.autoCheckFlags as unknown as AdRecord["autoCheckFlags"],
    creativeInput: row.creativeInput as unknown as AdRecord["creativeInput"],
    creative: row.creative as unknown as AdRecord["creative"],
    deliverablePlacements: row.deliverablePlacements as AdRecord["deliverablePlacements"],
  };
}

function campaignData(changes: AdCampaignChanges | NewAdCampaignInput) {
  const { budgetMinor, spendCapMinor, ...rest } = changes;
  return { ...rest, ...(budgetMinor === undefined ? {} : { budgetMinor: toBigIntOrNull(budgetMinor) }), ...(spendCapMinor === undefined ? {} : { spendCapMinor: toBigIntOrNull(spendCapMinor) }) };
}

function adSetData(changes: AdSetChanges | NewAdSetInput) {
  const { budgetMinor, bidMinor, audience, placements, ...rest } = changes;
  return {
    ...rest,
    ...(budgetMinor === undefined ? {} : { budgetMinor: toBigIntOrNull(budgetMinor) }),
    ...(bidMinor === undefined ? {} : { bidMinor: toBigIntOrNull(bidMinor) }),
    ...(audience === undefined ? {} : { audience: toJson(audience) }),
    ...(placements === undefined ? {} : { placements: [...placements] }),
  };
}

function adData(changes: AdChanges | NewAdInput) {
  const { appeal, creativeInput, creative, deliverablePlacements, autoCheckFlags, ...rest } = changes;
  return {
    ...rest,
    ...(autoCheckFlags === undefined ? {} : { autoCheckFlags: toJson(autoCheckFlags) }),
    ...(appeal === undefined ? {} : { appeal: appeal === null ? (null as unknown as Prisma.InputJsonValue) : toJson(appeal) }),
    ...(creativeInput === undefined ? {} : { creativeInput: toJson(creativeInput) }),
    ...(creative === undefined ? {} : { creative: toJson(creative) }),
    ...(deliverablePlacements === undefined ? {} : { deliverablePlacements: [...deliverablePlacements] }),
  };
}

const newestFirst = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export class PrismaAdCampaignsRepository implements AdCampaignsRepository {
  public async createCampaign(input: NewAdCampaignInput, now: Date): Promise<AdCampaignRecord> {
    return toCampaign(await prisma().adCampaign.create({ data: { ...campaignData(input), createdAt: now, updatedAt: now } as Prisma.AdCampaignUncheckedCreateInput }));
  }

  public async findCampaign(campaignId: string): Promise<AdCampaignRecord | undefined> {
    const row = await prisma().adCampaign.findUnique({ where: { id: campaignId } });
    return row === null ? undefined : toCampaign(row);
  }

  public async updateCampaign(campaignId: string, changes: AdCampaignChanges, now: Date): Promise<AdCampaignRecord> {
    return toCampaign(await prisma().adCampaign.update({ where: { id: campaignId }, data: { ...campaignData(changes), updatedAt: now } }));
  }

  public async deleteCampaignWithChildren(campaignId: string): Promise<void> {
    await prisma().$transaction([
      prisma().ad.deleteMany({ where: { campaignId } }),
      prisma().adSet.deleteMany({ where: { campaignId } }),
      prisma().adCampaign.deleteMany({ where: { id: campaignId } }),
    ]);
  }

  public async listCampaigns(accountId: string): Promise<readonly AdCampaignRecord[]> {
    return (await prisma().adCampaign.findMany({ where: { accountId }, orderBy: newestFirst })).map(toCampaign);
  }

  public async createAdSet(input: NewAdSetInput, now: Date): Promise<AdSetRecord> {
    return toAdSet(await prisma().adSet.create({ data: { ...adSetData(input), createdAt: now, updatedAt: now } as Prisma.AdSetUncheckedCreateInput }));
  }

  public async findAdSet(adSetId: string): Promise<AdSetRecord | undefined> {
    const row = await prisma().adSet.findUnique({ where: { id: adSetId } });
    return row === null ? undefined : toAdSet(row);
  }

  public async updateAdSet(adSetId: string, changes: AdSetChanges, now: Date): Promise<AdSetRecord> {
    return toAdSet(await prisma().adSet.update({ where: { id: adSetId }, data: { ...adSetData(changes), updatedAt: now } }));
  }

  public async listAdSets(accountId: string, campaignId?: string): Promise<readonly AdSetRecord[]> {
    return (await prisma().adSet.findMany({ where: { accountId, ...(campaignId === undefined ? {} : { campaignId }) }, orderBy: newestFirst })).map(toAdSet);
  }

  public async createAd(input: NewAdInput, now: Date): Promise<AdRecord> {
    return toAd(await prisma().ad.create({ data: { ...adData(input), createdAt: now, updatedAt: now } as Prisma.AdUncheckedCreateInput }));
  }

  public async findAd(adId: string): Promise<AdRecord | undefined> {
    const row = await prisma().ad.findUnique({ where: { id: adId } });
    return row === null ? undefined : toAd(row);
  }

  public async updateAd(adId: string, changes: AdChanges, now: Date): Promise<AdRecord> {
    return toAd(await prisma().ad.update({ where: { id: adId }, data: { ...adData(changes), updatedAt: now } }));
  }

  public async listAds(accountId: string, filter: AdListFilter): Promise<readonly AdRecord[]> {
    const rows = await prisma().ad.findMany({
      where: {
        accountId,
        ...(filter.campaignId === undefined ? {} : { campaignId: filter.campaignId }),
        ...(filter.adSetId === undefined ? {} : { adSetId: filter.adSetId }),
        ...(filter.reviewStatus === undefined ? {} : { reviewStatus: filter.reviewStatus }),
      },
      orderBy: newestFirst,
    });
    return rows.map(toAd);
  }

  public async listAdsAwaitingReview(limit: number): Promise<readonly AdRecord[]> {
    const rows = await prisma().ad.findMany({
      where: { OR: [{ reviewStatus: "pending" }, { appeal: { path: ["status"], equals: "pending" } }] },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
    return rows.map(toAd);
  }

  public async listDeliverableAds(): Promise<readonly DeliverableAd[]> {
    const ads = (await prisma().ad.findMany({ where: { status: "active", reviewStatus: "approved" } })).map(toAd);
    if (ads.length === 0) return [];
    const [campaigns, adSets] = await Promise.all([
      prisma().adCampaign.findMany({ where: { id: { in: [...new Set(ads.map((ad) => ad.campaignId))] }, status: "active" } }),
      prisma().adSet.findMany({ where: { id: { in: [...new Set(ads.map((ad) => ad.adSetId))] }, status: "active" } }),
    ]);
    const campaignsById = new Map(campaigns.map((row) => [row.id, toCampaign(row)]));
    const adSetsById = new Map(adSets.map((row) => [row.id, toAdSet(row)]));
    return ads.flatMap((ad) => {
      const campaign = campaignsById.get(ad.campaignId);
      const adSet = adSetsById.get(ad.adSetId);
      if (campaign === undefined || adSet === undefined) return [];
      const entry = { campaign, adSet, ad };
      return isAdDeliverable(entry) ? [entry] : [];
    });
  }
}
