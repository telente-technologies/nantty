import { findRecordInAccount, requireAccountAccess } from "@/mocks/mockAccountAccess.mock";
import { collectPlacementIssuesForAds, throwIfValidationIssues, validateAdInputs, validateAdSetInput, validateCampaignInput } from "@/mocks/mockCampaignValidation.mock";
import { resolveCreativeFromInput } from "@/mocks/mockCreativeResolver.mock";
import { appendMockActivity, readMockDatabase, type MockAdRecord, type MockCampaignRecord } from "@/mocks/mockDatabase.mock";
import { presentAd, presentAdSet, presentCampaign } from "@/mocks/mockDeliveryPresenter.mock";
import { MockHttpError, createMockId, paginateItems, readIsoNow, readJsonObjectBody, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { markAdAsSubmittedForReview } from "@/mocks/mockReviewQueue.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { applyBulkActionToRecords } from "@/mocks/handlers/bulkActions.mock";
import { requireMockAdsVerification } from "@/mocks/handlers/verificationAndWallet.mock";
import type { DeliveryStatus } from "@/types/campaign.type";

function readRangeFromQuery(request: MockRequest) {
  return { from: request.query.get("from"), to: request.query.get("to") };
}

function submitDraftAdsOfCampaignForReview(campaign: MockCampaignRecord): number {
  const database = readMockDatabase();
  let submittedCount = 0;
  for (const ad of database.ads.filter((candidate) => candidate.campaignId === campaign.id && (candidate.status === "draft" || candidate.status === "rejected"))) {
    markAdAsSubmittedForReview(ad);
    submittedCount += 1;
  }
  if (submittedCount > 0) {
    campaign.status = "in_review";
    for (const adSet of database.adSets.filter((candidate) => candidate.campaignId === campaign.id && candidate.status === "draft")) adSet.status = "in_review";
  }
  return submittedCount;
}

export function registerCampaignMockHandlers(): void {
  registerMockRoute("GET", "/ads/accounts/:accountId/campaigns", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const status = request.query.get("status");
    const objective = request.query.get("objective");
    const search = (request.query.get("search") ?? "").trim().toLowerCase();
    const campaigns = readMockDatabase()
      .campaigns.filter((campaign) => campaign.accountId === account.id)
      .filter((campaign) => (!status || campaign.status === status) && (!objective || campaign.objective === objective) && (!search || campaign.name.toLowerCase().includes(search)))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    const page = paginateItems(campaigns, request);
    return respondWithJson(200, { ...page, items: page.items.map((campaign) => presentCampaign(campaign, readRangeFromQuery(request))) });
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/campaigns", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "campaigns:manage");
    const body = readJsonObjectBody(request);
    if (body.submitForReview === true) requireMockAdsVerification(userId);
    const issues: { path: string; message: string }[] = [];
    const campaignInput = validateCampaignInput(body.campaign, account, issues);
    const adSetInput = validateAdSetInput(body.adSet, account, campaignInput.budgetLevel, issues);
    const adInputs = validateAdInputs(body.ads, account.id, issues);
    throwIfValidationIssues(issues);
    if (account.status !== "active") throw new MockHttpError(409, "AD_ACCOUNT_NOT_ACTIVE", "This ad account cannot run ads right now.");
    const resolvedCreatives = adInputs.map((adInput) => ({ creative: resolveCreativeFromInput(adInput.creative, account) }));
    collectPlacementIssuesForAds(resolvedCreatives, adSetInput.placements, issues);
    throwIfValidationIssues(issues);
    const database = readMockDatabase();
    const now = readIsoNow();
    const campaign: MockCampaignRecord = { ...campaignInput, id: createMockId("cmp"), accountId: account.id, status: "draft", createdAt: now, updatedAt: now };
    const adSet = { ...adSetInput, id: createMockId("ads"), accountId: account.id, campaignId: campaign.id, status: "draft" as DeliveryStatus, experimentId: null, createdAt: now, updatedAt: now };
    const ads: MockAdRecord[] = adInputs.map((adInput, index) => ({
      id: createMockId("ad"),
      accountId: account.id,
      campaignId: campaign.id,
      adSetId: adSet.id,
      name: adInput.name,
      status: "draft",
      review: { status: "not_submitted", policyCode: null, policyReason: null, reviewedAt: null, appeal: null },
      creative: resolvedCreatives[index]?.creative ?? resolveCreativeFromInput(adInput.creative, account),
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    }));
    database.campaigns.push(campaign);
    database.adSets.push(adSet);
    database.ads.push(...ads);
    if (body.submitForReview === true) submitDraftAdsOfCampaignForReview(campaign);
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "campaign_created", objectType: "campaign", objectId: campaign.id, objectName: campaign.name, summary: body.submitForReview === true ? `Created campaign and sent ${ads.length} ad${ads.length === 1 ? "" : "s"} for review` : "Saved campaign as a draft", changes: [] });
    return respondWithJson(201, { campaign: presentCampaign(campaign), adSet: presentAdSet(adSet), ads: ads.map((ad) => presentAd(ad)) });
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/campaigns/:campaignId", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    return respondWithJson(200, presentCampaign(findRecordInAccount(readMockDatabase().campaigns, account.id, request.params.campaignId, "campaign"), readRangeFromQuery(request)));
  });

  registerMockRoute("PATCH", "/ads/accounts/:accountId/campaigns/:campaignId", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "campaigns:manage");
    const campaign = findRecordInAccount(readMockDatabase().campaigns, account.id, request.params.campaignId, "campaign");
    const body = readJsonObjectBody(request);
    const issues: { path: string; message: string }[] = [];
    const merged = validateCampaignInput({ ...campaign, ...body, objective: campaign.objective }, account, issues);
    throwIfValidationIssues(issues);
    const changes = [];
    if (merged.name !== campaign.name) changes.push({ field: "Name", from: campaign.name, to: merged.name });
    if (JSON.stringify(merged.budget) !== JSON.stringify(campaign.budget)) changes.push({ field: "Budget", from: String(campaign.budget?.amount.amountMinor ?? "—"), to: String(merged.budget?.amount.amountMinor ?? "—") });
    Object.assign(campaign, { name: merged.name, budget: merged.budget, spendCap: merged.spendCap, schedule: merged.schedule, updatedAt: readIsoNow() });
    if (body.status === "active" || body.status === "paused") {
      if (!["active", "paused"].includes(campaign.status)) throw new MockHttpError(409, "STATUS_CHANGE_NOT_ALLOWED", "Only active or paused campaigns can be paused or resumed.");
      if (body.status === "active" && account.balanceMinor + account.creditsMinor <= 0 && account.fundingMode === "prepaid") throw new MockHttpError(402, "INSUFFICIENT_BALANCE", "Top up your balance before resuming delivery.");
      changes.push({ field: "Status", from: campaign.status, to: body.status });
      campaign.status = body.status;
    }
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "campaign_updated", objectType: "campaign", objectId: campaign.id, objectName: campaign.name, summary: "Edited campaign", changes });
    return respondWithJson(200, presentCampaign(campaign));
  });

  registerMockRoute("DELETE", "/ads/accounts/:accountId/campaigns/:campaignId", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:manage");
    const database = readMockDatabase();
    const campaign = findRecordInAccount(database.campaigns, account.id, request.params.campaignId, "campaign");
    if (campaign.status !== "draft") throw new MockHttpError(409, "ONLY_DRAFTS_CAN_BE_DELETED", "Only drafts can be deleted. Pause the campaign instead.");
    database.campaigns.splice(database.campaigns.indexOf(campaign), 1);
    for (const collection of [database.adSets, database.ads] as { campaignId: string }[][]) {
      for (let index = collection.length - 1; index >= 0; index -= 1) if (collection[index]?.campaignId === campaign.id) collection.splice(index, 1);
    }
    return respondWithNoContent();
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/campaigns/:campaignId/submit", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "campaigns:manage");
    requireMockAdsVerification(userId);
    const campaign = findRecordInAccount(readMockDatabase().campaigns, account.id, request.params.campaignId, "campaign");
    const submittedCount = submitDraftAdsOfCampaignForReview(campaign);
    if (submittedCount === 0) throw new MockHttpError(409, "NOTHING_TO_SUBMIT", "There are no draft or rejected ads to send for review.");
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "campaign_submitted", objectType: "campaign", objectId: campaign.id, objectName: campaign.name, summary: `Sent ${submittedCount} ad${submittedCount === 1 ? "" : "s"} for review`, changes: [] });
    return respondWithJson(200, presentCampaign(campaign));
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/campaigns/:campaignId/duplicate", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:manage");
    const [copyId] = applyBulkActionToRecords(account.id, "campaign", [request.params.campaignId ?? ""], "duplicate").createdIds;
    const copy = readMockDatabase().campaigns.find((candidate) => candidate.id === copyId);
    if (!copy) throw new MockHttpError(404, "NOT_FOUND", "Campaign not found.");
    return respondWithJson(201, presentCampaign(copy));
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/bulk-actions", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "campaigns:manage");
    const body = readJsonObjectBody(request);
    const level = body.level === "ad_set" || body.level === "ad" ? body.level : "campaign";
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 100) : [];
    const action = ["pause", "resume", "archive", "duplicate", "submit_for_review"].includes(String(body.action)) ? (body.action as "pause") : null;
    if (!action || ids.length === 0) throw new MockHttpError(400, "VALIDATION_FAILED", "Choose items and an action.");
    const result = applyBulkActionToRecords(account.id, level, ids, action);
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: `bulk_${action}`, objectType: level, objectId: ids.join(","), objectName: `${result.succeededIds.length} ${level.replace("_", " ")}(s)`, summary: `Bulk ${action.replace(/_/g, " ")}`, changes: [] });
    return respondWithJson(200, { succeededIds: result.succeededIds, failed: result.failed });
  });
}
