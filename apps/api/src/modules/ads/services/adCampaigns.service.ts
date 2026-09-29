import { adsConflict, adsError, adsNotFound, throwIfValidationIssues, type ValidationIssue } from "../../../errors/ads.error.js";
import type { AdCampaignRecord } from "../models/adCampaigns.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import type { CampaignDraftSubmissionBody, DeliveryRangeQuery, UpdateCampaignBody } from "../validators/adCampaigns.validator.js";
import { describeFieldChanges, paginateAdsItems, type AdAccountAccess } from "./adAccountAccess.service.js";
import { describeAdvertiser } from "./adAccounts.service.js";
import { validateAdSetInput, validateBudget, validateCampaignInput, validateCreativeInput, validateSchedule } from "./adCampaignValidation.service.js";
import type { AdCreativesService } from "./adCreatives.service.js";
import { assertAccountActive, attachAdDraft, loadDeliveryWindow, resolveAdDraft, type AdDraft } from "./adDeliveryWindow.service.js";
import { presentAd, presentAdSet, presentCampaign } from "./adPresenter.service.js";
import type { AdReviewService } from "./adReview.service.js";

const DEFAULT_PAGE_SIZE = 50;

export class AdCampaignsService {
  public constructor(
    private readonly dependencies: AdsDependencies,
    private readonly access: AdAccountAccess,
    private readonly creatives: AdCreativesService,
    private readonly review: AdReviewService,
  ) {}

  public async listCampaigns(userId: string, accountId: string, query: DeliveryRangeQuery) {
    await this.access.requirePermission(userId, accountId, "campaigns:view");
    const { campaigns } = this.dependencies;
    const search = query.search?.trim().toLowerCase();
    const matching = (await campaigns.listCampaigns(accountId)).filter(
      (campaign) =>
        (query.status === undefined || campaign.status === query.status) &&
        (query.objective === undefined || campaign.objective === query.objective) &&
        (search === undefined || search === "" || campaign.name.toLowerCase().includes(search)),
    );
    const page = paginateAdsItems(matching, query.cursor, query.limit ?? DEFAULT_PAGE_SIZE);
    const [adSets, ads, window] = await Promise.all([campaigns.listAdSets(accountId), campaigns.listAds(accountId, {}), loadDeliveryWindow(this.dependencies, { accountId }, query)]);
    return { ...page, items: page.items.map((campaign) => presentCampaign(campaign, adSets, ads, window)) };
  }

  public async getCampaign(userId: string, accountId: string, campaignId: string, range: DeliveryRangeQuery) {
    await this.access.requirePermission(userId, accountId, "campaigns:view");
    return this.presentCampaignById(accountId, await this.findCampaign(accountId, campaignId), range);
  }

  public async createCampaignDraft(userId: string, accountId: string, body: CampaignDraftSubmissionBody) {
    const { account } = await this.access.requirePermission(userId, accountId, "campaigns:manage");
    assertAccountActive(account);
    const issues: ValidationIssue[] = [];
    const campaignInput = validateCampaignInput(body.campaign, account, issues);
    const adSetInput = validateAdSetInput(body.adSet, account, campaignInput.budgetLevel, issues);
    if (body.ads.length === 0 || body.ads.length > 6) issues.push({ path: "ads", message: "Add between 1 and 6 ads." });
    const creativeInputs = body.ads.map((ad, index) => ({ name: ad.name, creative: validateCreativeInput(ad.creative, `ads.${index}.creative`, issues) }));
    const drafts: AdDraft[] = [];
    for (const [index, ad] of creativeInputs.entries()) drafts.push(await resolveAdDraft(this.creatives, account, adSetInput.placements, ad.name, ad.creative, `ads.${index}`, issues));
    throwIfValidationIssues(issues);
    const { campaigns, clock } = this.dependencies;
    const now = clock.now();
    const campaign = await campaigns.createCampaign({ accountId, ...campaignInput, status: "draft", currency: account.currency, origin: "ads_manager", prepaid: false }, now);
    const adSet = await campaigns.createAdSet({ accountId, campaignId: campaign.id, ...adSetInput, status: "draft" }, now);
    let ads = [];
    for (const draft of drafts) ads.push(await campaigns.createAd(attachAdDraft(draft, account, campaign, adSet), now));
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "campaign", objectId: campaign.id, summary: `Created campaign "${campaign.name}"`, changes: [] });
    if (body.submitForReview) {
      ads = await Promise.all(ads.map((ad) => this.review.submitAdForReview(ad)));
      await this.review.recomputeCampaignStatuses(campaign.id);
    }
    const window = { events: [], todayStart: now };
    const currentCampaign = (await campaigns.findCampaign(campaign.id)) ?? campaign;
    const currentAdSet = (await campaigns.findAdSet(adSet.id)) ?? adSet;
    return {
      campaign: presentCampaign(currentCampaign, [currentAdSet], ads, window),
      adSet: presentAdSet(currentAdSet, currentCampaign, ads, window),
      ads: ads.map((ad) => presentAd(ad, currentCampaign, window)),
    };
  }

  public async updateCampaign(userId: string, accountId: string, campaignId: string, body: UpdateCampaignBody) {
    const { account } = await this.access.requirePermission(userId, accountId, "campaigns:manage");
    const campaign = await this.findCampaign(accountId, campaignId);
    if (body.objective !== undefined && body.objective !== campaign.objective) throwIfValidationIssues([{ path: "objective", message: "The objective of a campaign cannot be changed." }]);
    const issues: ValidationIssue[] = [];
    const schedule = body.schedule === undefined ? { startAt: campaign.startAt, endAt: campaign.endAt } : validateSchedule(body.schedule, "schedule", issues);
    const budgetLevel = body.budgetLevel ?? campaign.budgetLevel;
    const budget = body.budget === undefined ? undefined : budgetLevel === "campaign" ? validateBudget(body.budget, "budget", account, schedule, issues) : { budgetType: null, budgetMinor: null };
    const name = body.name?.trim();
    if (name !== undefined && (name.length === 0 || name.length > 120)) issues.push({ path: "name", message: "Name the campaign (up to 120 characters)." });
    throwIfValidationIssues(issues);
    if (body.status !== undefined) await this.assertStatusChangeAllowed(campaign, body.status);
    const changes = {
      ...(name === undefined ? {} : { name }),
      ...(body.budgetLevel === undefined ? {} : { budgetLevel }),
      ...(budget === undefined ? {} : budget),
      ...(body.spendCap === undefined ? {} : { spendCapMinor: body.spendCap === null ? null : body.spendCap.amountMinor }),
      ...(body.schedule === undefined ? {} : schedule),
      ...(body.status === undefined ? {} : { status: body.status }),
    };
    const updated = await this.dependencies.campaigns.updateCampaign(campaignId, changes, this.dependencies.clock.now());
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "campaign", objectId: campaignId, summary: "Updated the campaign", changes: describeFieldChanges(campaign, changes) });
    return this.presentCampaignById(accountId, updated, {});
  }

  public async deleteCampaign(userId: string, accountId: string, campaignId: string): Promise<void> {
    await this.access.requirePermission(userId, accountId, "campaigns:manage");
    const campaign = await this.findCampaign(accountId, campaignId);
    if (campaign.status !== "draft") throw adsConflict("ONLY_DRAFTS_CAN_BE_DELETED", "Only draft campaigns can be deleted.");
    await this.dependencies.campaigns.deleteCampaignWithChildren(campaignId);
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "campaign", objectId: campaignId, summary: `Deleted draft campaign "${campaign.name}"`, changes: [] });
  }

  public async submitCampaign(userId: string, accountId: string, campaignId: string) {
    const { account } = await this.access.requirePermission(userId, accountId, "campaigns:manage");
    assertAccountActive(account);
    const campaign = await this.findCampaign(accountId, campaignId);
    const submittable = (await this.dependencies.campaigns.listAds(accountId, { campaignId })).filter((ad) => ad.status === "draft" || ad.status === "rejected");
    if (submittable.length === 0) throw adsConflict("NOTHING_TO_SUBMIT", "There are no draft or rejected ads to submit.");
    for (const ad of submittable) await this.review.submitAdForReview(ad);
    const updated = (await this.review.recomputeCampaignStatuses(campaignId)) ?? campaign;
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "campaign", objectId: campaignId, summary: `Submitted ${submittable.length} ad(s) for review`, changes: [] });
    return this.presentCampaignById(accountId, updated, {});
  }

  public async duplicateCampaign(userId: string, accountId: string, campaignId: string) {
    await this.access.requirePermission(userId, accountId, "campaigns:manage");
    const copy = await this.copyCampaign(accountId, await this.findCampaign(accountId, campaignId));
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "campaign", objectId: copy.id, summary: `Duplicated campaign "${copy.name}"`, changes: [] });
    return this.presentCampaignById(accountId, copy, {});
  }

  public async copyCampaign(accountId: string, campaign: AdCampaignRecord): Promise<AdCampaignRecord> {
    const { campaigns, clock } = this.dependencies;
    const now = clock.now();
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = campaign;
    const copy = await campaigns.createCampaign({ ...rest, name: `${campaign.name} (copy)`.slice(0, 120), status: "draft" }, now);
    for (const adSet of await campaigns.listAdSets(accountId, campaign.id)) {
      const { id: adSetId, createdAt: _adSetCreatedAt, updatedAt: _adSetUpdatedAt, ...adSetRest } = adSet;
      const newAdSet = await campaigns.createAdSet({ ...adSetRest, campaignId: copy.id, status: "draft" }, now);
      for (const ad of await campaigns.listAds(accountId, { adSetId })) {
        const { id: _adId, createdAt: _adCreatedAt, updatedAt: _adUpdatedAt, ...adRest } = ad;
        await campaigns.createAd({ ...adRest, campaignId: copy.id, adSetId: newAdSet.id, status: "draft", reviewStatus: "not_submitted", policyCode: null, policyReason: null, reviewedAt: null, reviewedById: null, appeal: null, autoCheckFlags: [], submittedAt: null }, now);
      }
    }
    return copy;
  }

  public async findCampaign(accountId: string, campaignId: string): Promise<AdCampaignRecord> {
    const campaign = await this.dependencies.campaigns.findCampaign(campaignId);
    if (campaign === undefined || campaign.accountId !== accountId) throw adsNotFound("Campaign");
    return campaign;
  }

  public async assertStatusChangeAllowed(campaign: AdCampaignRecord, status: "active" | "paused"): Promise<void> {
    const allowed = status === "paused" ? campaign.status === "active" || campaign.status === "paused" : campaign.status === "paused" || campaign.status === "active";
    if (!allowed) throw adsConflict("STATUS_CHANGE_NOT_ALLOWED", `A ${campaign.status} campaign cannot be set to ${status}.`);
    if (status !== "active" || campaign.prepaid) return;
    const account = await this.dependencies.accounts.findAccountById(campaign.accountId);
    if (account === undefined) throw adsNotFound("Ad account");
    const balance = await this.dependencies.advertiserBilling.findAdvertiserWalletBalance(describeAdvertiser(account), account.currency).catch(() => undefined);
    if (balance === undefined || balance.amountMinor <= 0) throw adsError(402, "INSUFFICIENT_BALANCE", "Top up the ad account before resuming delivery.");
  }

  private async presentCampaignById(accountId: string, campaign: AdCampaignRecord, range: DeliveryRangeQuery) {
    const { campaigns } = this.dependencies;
    const [adSets, ads, window] = await Promise.all([
      campaigns.listAdSets(accountId, campaign.id),
      campaigns.listAds(accountId, { campaignId: campaign.id }),
      loadDeliveryWindow(this.dependencies, { accountId, campaignIds: [campaign.id] }, range),
    ]);
    return presentCampaign(campaign, adSets, ads, window);
  }
}
