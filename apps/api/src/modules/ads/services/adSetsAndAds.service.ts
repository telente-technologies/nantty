import { adsConflict, adsNotFound, throwIfValidationIssues, type ValidationIssue } from "../../../errors/ads.error.js";
import type { AdRecord, AdSetRecord, AdPlacement } from "../models/adCampaigns.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import type { AdSetInputBody, CreativeInputBody, DeliveryRangeQuery, UpdateAdBody, UpdateAdSetBody } from "../validators/adCampaigns.validator.js";
import { describeFieldChanges, paginateAdsItems, type AdAccountAccess } from "./adAccountAccess.service.js";
import type { AdCampaignsService } from "./adCampaigns.service.js";
import { validateAdSetInput, validateAudience, validateBudget, validateCreativeInput, validateSchedule } from "./adCampaignValidation.service.js";
import type { AdCreativesService } from "./adCreatives.service.js";
import { assertAccountActive, attachAdDraft, loadDeliveryWindow, resolveAdDraft } from "./adDeliveryWindow.service.js";
import { describeCreativeShape, listPlacementsWhereCreativeCanRun } from "./adPlacementRules.service.js";
import { presentAd, presentAdSet } from "./adPresenter.service.js";
import type { AdReviewService } from "./adReview.service.js";
import { ALL_AD_PLACEMENTS } from "../models/adCampaigns.model.js";

const DEFAULT_PAGE_SIZE = 50;

export class AdSetsAndAdsService {
  public constructor(
    private readonly dependencies: AdsDependencies,
    private readonly access: AdAccountAccess,
    private readonly creatives: AdCreativesService,
    private readonly review: AdReviewService,
    private readonly campaignsService: AdCampaignsService,
  ) {}

  public async listAdSets(userId: string, accountId: string, query: DeliveryRangeQuery) {
    await this.access.requirePermission(userId, accountId, "campaigns:view");
    const { campaigns } = this.dependencies;
    const adSets = await campaigns.listAdSets(accountId, query.campaignId);
    const page = paginateAdsItems(adSets, query.cursor, query.limit ?? DEFAULT_PAGE_SIZE);
    const [campaignList, ads, window] = await Promise.all([campaigns.listCampaigns(accountId), campaigns.listAds(accountId, {}), loadDeliveryWindow(this.dependencies, { accountId }, query)]);
    const campaignsById = new Map(campaignList.map((campaign) => [campaign.id, campaign]));
    return { ...page, items: page.items.flatMap((adSet) => { const campaign = campaignsById.get(adSet.campaignId); return campaign === undefined ? [] : [presentAdSet(adSet, campaign, ads, window)]; }) };
  }

  public async createAdSet(userId: string, accountId: string, campaignId: string, body: AdSetInputBody) {
    const { account } = await this.access.requirePermission(userId, accountId, "campaigns:manage");
    assertAccountActive(account);
    const campaign = await this.campaignsService.findCampaign(accountId, campaignId);
    const issues: ValidationIssue[] = [];
    const input = validateAdSetInput(body, account, campaign.budgetLevel, issues);
    throwIfValidationIssues(issues);
    const adSet = await this.dependencies.campaigns.createAdSet({ accountId, campaignId, ...input, status: "draft" }, this.dependencies.clock.now());
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "ad_set", objectId: adSet.id, summary: `Created ad set "${adSet.name}"`, changes: [] });
    return this.presentAdSetById(accountId, adSet, {});
  }

  public async getAdSet(userId: string, accountId: string, adSetId: string, range: DeliveryRangeQuery) {
    await this.access.requirePermission(userId, accountId, "campaigns:view");
    return this.presentAdSetById(accountId, await this.findAdSet(accountId, adSetId), range);
  }

  public async updateAdSet(userId: string, accountId: string, adSetId: string, body: UpdateAdSetBody) {
    const { account } = await this.access.requirePermission(userId, accountId, "campaigns:manage");
    const adSet = await this.findAdSet(accountId, adSetId);
    const campaign = await this.campaignsService.findCampaign(accountId, adSet.campaignId);
    const issues: ValidationIssue[] = [];
    const schedule = body.schedule === undefined ? { startAt: adSet.startAt, endAt: adSet.endAt } : validateSchedule(body.schedule, "schedule", issues);
    const budget = body.budget === undefined || campaign.budgetLevel !== "ad_set" ? undefined : validateBudget(body.budget, "budget", account, schedule, issues);
    const placementMode = body.placementMode ?? adSet.placementMode;
    const placements: readonly AdPlacement[] | undefined = body.placementMode === undefined && body.placements === undefined ? undefined : placementMode === "automatic" ? ALL_AD_PLACEMENTS : [...new Set(body.placements ?? adSet.placements)];
    if (placements !== undefined && placements.length === 0) issues.push({ path: "placements", message: "Choose at least one placement." });
    const bid = body.bidStrategy;
    if (bid !== undefined && bid.type !== "auto" && (bid.amount === null || bid.amount === undefined || bid.amount.currency !== account.currency || bid.amount.amountMinor <= 0)) issues.push({ path: "bidStrategy.amount", message: `Enter a bid amount in ${account.currency}.` });
    const cap = body.frequencyCap;
    if (cap !== undefined && cap !== null && (cap.impressions < 1 || cap.impressions > 20 || cap.perDays < 1 || cap.perDays > 30)) issues.push({ path: "frequencyCap", message: "Frequency cap must be 1–20 impressions per 1–30 days." });
    const audience = body.audience === undefined ? undefined : validateAudience(body.audience, "audience", issues);
    throwIfValidationIssues(issues);
    if (body.status !== undefined) await this.campaignsService.assertStatusChangeAllowed({ ...campaign, status: adSet.status }, body.status);
    const changes = {
      ...(body.name === undefined ? {} : { name: body.name.trim() }),
      ...(audience === undefined ? {} : { audience }),
      ...(placements === undefined ? {} : { placementMode, placements }),
      ...(body.schedule === undefined ? {} : schedule),
      ...(budget === undefined ? {} : budget),
      ...(bid === undefined ? {} : { bidType: bid.type, bidMinor: bid.type === "auto" ? null : bid.amount?.amountMinor ?? null }),
      ...(cap === undefined ? {} : { frequencyImpressions: cap?.impressions ?? null, frequencyDays: cap?.perDays ?? null }),
      ...(body.status === undefined ? {} : { status: body.status }),
    };
    const updated = await this.dependencies.campaigns.updateAdSet(adSetId, changes, this.dependencies.clock.now());
    if (placements !== undefined) await this.refreshDeliverablePlacements(accountId, updated);
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "ad_set", objectId: adSetId, summary: "Updated the ad set", changes: describeFieldChanges(adSet, changes) });
    return this.presentAdSetById(accountId, updated, {});
  }

  public async listAds(userId: string, accountId: string, query: DeliveryRangeQuery) {
    await this.access.requirePermission(userId, accountId, "campaigns:view");
    const { campaigns } = this.dependencies;
    const filter = { ...(query.campaignId === undefined ? {} : { campaignId: query.campaignId }), ...(query.adSetId === undefined ? {} : { adSetId: query.adSetId }), ...(query.reviewStatus === undefined ? {} : { reviewStatus: query.reviewStatus }) };
    const page = paginateAdsItems(await campaigns.listAds(accountId, filter), query.cursor, query.limit ?? DEFAULT_PAGE_SIZE);
    const [campaignList, window] = await Promise.all([campaigns.listCampaigns(accountId), loadDeliveryWindow(this.dependencies, { accountId }, query)]);
    const campaignsById = new Map(campaignList.map((campaign) => [campaign.id, campaign]));
    return { ...page, items: page.items.flatMap((ad) => { const campaign = campaignsById.get(ad.campaignId); return campaign === undefined ? [] : [presentAd(ad, campaign, window)]; }) };
  }

  public async createAd(userId: string, accountId: string, adSetId: string, name: string, creativeBody: CreativeInputBody) {
    const { account } = await this.access.requirePermission(userId, accountId, "campaigns:manage");
    assertAccountActive(account);
    const adSet = await this.findAdSet(accountId, adSetId);
    const campaign = await this.campaignsService.findCampaign(accountId, adSet.campaignId);
    const issues: ValidationIssue[] = [];
    const creativeInput = validateCreativeInput(creativeBody, "creative", issues);
    const draft = await resolveAdDraft(this.creatives, account, adSet.placements, name, creativeInput, "", issues);
    throwIfValidationIssues(issues.map((issue) => ({ ...issue, path: issue.path.replace(/^\./, "") })));
    const ad = await this.dependencies.campaigns.createAd(attachAdDraft(draft, account, campaign, adSet), this.dependencies.clock.now());
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "ad", objectId: ad.id, summary: `Created ad "${ad.name}"`, changes: [] });
    return this.presentAdById(accountId, ad, {});
  }

  public async getAd(userId: string, accountId: string, adId: string, range: DeliveryRangeQuery) {
    await this.access.requirePermission(userId, accountId, "campaigns:view");
    return this.presentAdById(accountId, await this.findAd(accountId, adId), range);
  }

  public async updateAd(userId: string, accountId: string, adId: string, body: UpdateAdBody) {
    const { account } = await this.access.requirePermission(userId, accountId, "campaigns:manage");
    const ad = await this.findAd(accountId, adId);
    const adSet = await this.findAdSet(accountId, ad.adSetId);
    const issues: ValidationIssue[] = [];
    let changes: Partial<AdRecord> = body.name === undefined ? {} : { name: body.name.trim().slice(0, 120) || ad.name };
    if (body.creative !== undefined) {
      const creativeInput = validateCreativeInput(body.creative, "creative", issues);
      const draft = await resolveAdDraft(this.creatives, account, adSet.placements, ad.name, creativeInput, "", issues);
      changes = { ...changes, creativeInput, creative: draft.creative, deliverablePlacements: draft.deliverablePlacements };
    }
    throwIfValidationIssues(issues.map((issue) => ({ ...issue, path: issue.path.replace(/^\./, "") })));
    if (body.status !== undefined) {
      const allowed = ad.status === "active" || ad.status === "paused";
      if (!allowed) throw adsConflict("STATUS_CHANGE_NOT_ALLOWED", `A ${ad.status} ad cannot be set to ${body.status}.`);
      changes = { ...changes, status: body.status };
    }
    let updated = await this.dependencies.campaigns.updateAd(adId, changes, this.dependencies.clock.now());
    if (body.creative !== undefined && ad.status !== "draft") updated = await this.review.submitAdForReview(updated);
    await this.review.recomputeCampaignStatuses(ad.campaignId);
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "ad", objectId: adId, summary: body.creative === undefined ? "Updated the ad" : "Edited the creative", changes: describeFieldChanges(ad, { name: changes.name, status: changes.status }) });
    return this.presentAdById(accountId, updated, {});
  }

  public async appealAd(userId: string, accountId: string, adId: string, message: string) {
    await this.access.requirePermission(userId, accountId, "campaigns:manage");
    const ad = await this.findAd(accountId, adId);
    if (ad.reviewStatus !== "rejected") throw adsConflict("NOT_REJECTED", "Only rejected ads can be appealed.");
    if (ad.appeal !== null) throw adsConflict("ALREADY_APPEALED", "This decision has already been appealed.");
    const now = this.dependencies.clock.now();
    const updated = await this.dependencies.campaigns.updateAd(adId, { appeal: { status: "pending", message: message.trim(), submittedAt: now.toISOString(), resolvedAt: null, resolutionNote: null } }, now);
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "ad", objectId: adId, summary: "Appealed the review decision", changes: [] });
    return this.presentAdById(accountId, updated, {});
  }

  public async findAdSet(accountId: string, adSetId: string): Promise<AdSetRecord> {
    const adSet = await this.dependencies.campaigns.findAdSet(adSetId);
    if (adSet === undefined || adSet.accountId !== accountId) throw adsNotFound("Ad set");
    return adSet;
  }

  public async findAd(accountId: string, adId: string): Promise<AdRecord> {
    const ad = await this.dependencies.campaigns.findAd(adId);
    if (ad === undefined || ad.accountId !== accountId) throw adsNotFound("Ad");
    return ad;
  }

  private async refreshDeliverablePlacements(accountId: string, adSet: AdSetRecord): Promise<void> {
    for (const ad of await this.dependencies.campaigns.listAds(accountId, { adSetId: adSet.id })) {
      const deliverablePlacements = listPlacementsWhereCreativeCanRun(describeCreativeShape(ad.creative), adSet.placements);
      await this.dependencies.campaigns.updateAd(ad.id, { deliverablePlacements }, this.dependencies.clock.now());
    }
  }

  private async presentAdSetById(accountId: string, adSet: AdSetRecord, range: DeliveryRangeQuery) {
    const campaign = await this.campaignsService.findCampaign(accountId, adSet.campaignId);
    const [ads, window] = await Promise.all([this.dependencies.campaigns.listAds(accountId, { adSetId: adSet.id }), loadDeliveryWindow(this.dependencies, { accountId, adSetId: adSet.id }, range)]);
    return presentAdSet(adSet, campaign, ads, window);
  }

  private async presentAdById(accountId: string, ad: AdRecord, range: DeliveryRangeQuery) {
    const campaign = await this.campaignsService.findCampaign(accountId, ad.campaignId);
    return presentAd(ad, campaign, await loadDeliveryWindow(this.dependencies, { accountId, adId: ad.id }, range));
  }
}
