import type { AdsDependencies } from "../models/adsDependencies.model.js";
import type { BulkActionBody } from "../validators/adCampaigns.validator.js";
import type { AdAccountAccess } from "./adAccountAccess.service.js";
import type { AdCampaignsService } from "./adCampaigns.service.js";
import type { AdReviewService } from "./adReview.service.js";
import type { AdSetsAndAdsService } from "./adSetsAndAds.service.js";

export class AdBulkActionsService {
  public constructor(
    private readonly dependencies: AdsDependencies,
    private readonly access: AdAccountAccess,
    private readonly campaignsService: AdCampaignsService,
    private readonly adSetsAndAds: AdSetsAndAdsService,
    private readonly review: AdReviewService,
  ) {}

  public async applyBulkAction(userId: string, accountId: string, body: BulkActionBody) {
    await this.access.requirePermission(userId, accountId, "campaigns:manage");
    const succeededIds: string[] = [];
    const failed: { id: string; message: string }[] = [];
    for (const id of [...new Set(body.ids)]) {
      try {
        await this.applyToOne(accountId, body, id);
        succeededIds.push(id);
      } catch (error) {
        failed.push({ id, message: error instanceof Error ? error.message : "The action failed." });
      }
    }
    await this.access.recordActivity({ accountId, actorId: userId, objectType: body.level, objectId: succeededIds[0] ?? accountId, summary: `Bulk ${body.action} on ${succeededIds.length} ${body.level}(s)`, changes: [] });
    return { succeededIds, failed };
  }

  private async applyToOne(accountId: string, body: BulkActionBody, id: string): Promise<void> {
    const { campaigns, clock } = this.dependencies;
    const now = clock.now();
    const nextStatus = body.action === "pause" ? "paused" : body.action === "resume" ? "active" : body.action === "archive" ? "completed" : undefined;
    if (body.level === "campaign") {
      const campaign = await this.campaignsService.findCampaign(accountId, id);
      if (body.action === "duplicate") await this.campaignsService.copyCampaign(accountId, campaign);
      else if (body.action === "submit_for_review") await this.submitAds((await campaigns.listAds(accountId, { campaignId: id })), campaign.id);
      else if (nextStatus !== undefined) {
        if (nextStatus !== "completed") await this.campaignsService.assertStatusChangeAllowed(campaign, nextStatus);
        await campaigns.updateCampaign(id, { status: nextStatus }, now);
      }
      return;
    }
    if (body.level === "ad_set") {
      const adSet = await this.adSetsAndAds.findAdSet(accountId, id);
      if (body.action === "duplicate") {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = adSet;
        await campaigns.createAdSet({ ...rest, name: `${adSet.name} (copy)`.slice(0, 120), status: "draft" }, now);
      } else if (body.action === "submit_for_review") await this.submitAds(await campaigns.listAds(accountId, { adSetId: id }), adSet.campaignId);
      else if (nextStatus !== undefined) await campaigns.updateAdSet(id, { status: nextStatus }, now);
      return;
    }
    const ad = await this.adSetsAndAds.findAd(accountId, id);
    if (body.action === "duplicate") {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = ad;
      await campaigns.createAd({ ...rest, name: `${ad.name} (copy)`.slice(0, 120), status: "draft", reviewStatus: "not_submitted", appeal: null, autoCheckFlags: [], submittedAt: null, reviewedAt: null, reviewedById: null, policyCode: null, policyReason: null }, now);
    } else if (body.action === "submit_for_review") await this.submitAds([ad], ad.campaignId);
    else if (nextStatus !== undefined) {
      if (nextStatus !== "completed" && ad.status !== "active" && ad.status !== "paused") throw new Error(`A ${ad.status} ad cannot be ${body.action}d.`);
      await campaigns.updateAd(id, { status: nextStatus }, now);
      await this.review.recomputeCampaignStatuses(ad.campaignId);
    }
  }

  private async submitAds(ads: readonly Awaited<ReturnType<AdSetsAndAdsService["findAd"]>>[], campaignId: string): Promise<void> {
    const submittable = ads.filter((ad) => ad.status === "draft" || ad.status === "rejected");
    if (submittable.length === 0) throw new Error("There is nothing to submit.");
    for (const ad of submittable) await this.review.submitAdForReview(ad);
    await this.review.recomputeCampaignStatuses(campaignId);
  }
}
