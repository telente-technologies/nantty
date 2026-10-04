import { findRecordInAccount, requireAccountAccess } from "@/mocks/mockAccountAccess.mock";
import { collectPlacementIssuesForAds, throwIfValidationIssues, validateAdSetInput, validateCreativeInput } from "@/mocks/mockCampaignValidation.mock";
import { resolveCreativeFromInput } from "@/mocks/mockCreativeResolver.mock";
import { appendMockActivity, readMockDatabase, type MockAdRecord, type MockAdSetRecord } from "@/mocks/mockDatabase.mock";
import { presentAd, presentAdSet } from "@/mocks/mockDeliveryPresenter.mock";
import { MockHttpError, createMockId, paginateItems, readIsoNow, readJsonObjectBody, respondWithJson } from "@/mocks/mockResponses.mock";
import { markAdAsSubmittedForReview } from "@/mocks/mockReviewQueue.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";

function readRange(request: MockRequest) {
  return { from: request.query.get("from"), to: request.query.get("to") };
}

function applyStatusChange(record: MockAdSetRecord | MockAdRecord, status: unknown): void {
  if (status !== "active" && status !== "paused") return;
  if (!["active", "paused"].includes(record.status)) throw new MockHttpError(409, "STATUS_CHANGE_NOT_ALLOWED", "Only active or paused items can be paused or resumed.");
  record.status = status;
}

export function registerAdSetAndAdMockHandlers(): void {
  registerMockRoute("GET", "/ads/accounts/:accountId/ad-sets", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const campaignId = request.query.get("campaignId");
    const adSets = readMockDatabase().adSets.filter((adSet) => adSet.accountId === account.id && (!campaignId || adSet.campaignId === campaignId));
    const page = paginateItems(adSets, request, 100);
    return respondWithJson(200, { ...page, items: page.items.map((adSet) => presentAdSet(adSet, readRange(request))) });
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/ad-sets/:adSetId", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    return respondWithJson(200, presentAdSet(findRecordInAccount(readMockDatabase().adSets, account.id, request.params.adSetId, "ad set"), readRange(request)));
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/ad-sets", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:manage");
    const body = readJsonObjectBody(request);
    const database = readMockDatabase();
    const campaign = findRecordInAccount(database.campaigns, account.id, String(body.campaignId ?? ""), "campaign");
    const issues: { path: string; message: string }[] = [];
    const input = validateAdSetInput(body, account, campaign.budgetLevel, issues);
    throwIfValidationIssues(issues);
    const now = readIsoNow();
    const adSet: MockAdSetRecord = { ...input, id: createMockId("ads"), accountId: account.id, campaignId: campaign.id, status: "draft", experimentId: null, createdAt: now, updatedAt: now };
    database.adSets.push(adSet);
    return respondWithJson(201, presentAdSet(adSet));
  });

  registerMockRoute("PATCH", "/ads/accounts/:accountId/ad-sets/:adSetId", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "campaigns:manage");
    const database = readMockDatabase();
    const adSet = findRecordInAccount(database.adSets, account.id, request.params.adSetId, "ad set");
    const campaign = findRecordInAccount(database.campaigns, account.id, adSet.campaignId, "campaign");
    const body = readJsonObjectBody(request);
    const issues: { path: string; message: string }[] = [];
    const merged = validateAdSetInput({ ...adSet, ...body }, account, campaign.budgetLevel, issues);
    throwIfValidationIssues(issues);
    Object.assign(adSet, merged, { updatedAt: readIsoNow() });
    applyStatusChange(adSet, body.status);
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "ad_set_updated", objectType: "ad_set", objectId: adSet.id, objectName: adSet.name, summary: "Edited ad set", changes: Object.keys(body).map((field) => ({ field, from: null, to: null })) });
    return respondWithJson(200, presentAdSet(adSet));
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/ads", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const campaignId = request.query.get("campaignId");
    const adSetId = request.query.get("adSetId");
    const reviewStatus = request.query.get("reviewStatus");
    const ads = readMockDatabase().ads.filter((ad) => ad.accountId === account.id && (!campaignId || ad.campaignId === campaignId) && (!adSetId || ad.adSetId === adSetId) && (!reviewStatus || ad.review.status === reviewStatus));
    const page = paginateItems(ads, request, 100);
    return respondWithJson(200, { ...page, items: page.items.map((ad) => presentAd(ad, readRange(request))) });
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/ads/:adId", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    return respondWithJson(200, presentAd(findRecordInAccount(readMockDatabase().ads, account.id, request.params.adId, "ad"), readRange(request)));
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/ads/:adId/cards/report", (request) => {
    const { account } = requireAccountAccess(request, "reports:view");
    const ad = findRecordInAccount(readMockDatabase().ads, account.id, request.params.adId, "ad");
    const items = (ad.creative.cards ?? []).map((card, cardIndex) => {
      const impressions = Math.max(0, Math.round(presentAd(ad, readRange(request)).delivery.impressions * (0.9 - cardIndex * 0.08)));
      const clicks = Math.round(impressions * Math.max(0.004, 0.03 - cardIndex * 0.003));
      return { cardIndex, headline: card.headline, imageUrl: card.media.url, impressions, clicks, ctr: impressions > 0 ? clicks / impressions : 0 };
    });
    return respondWithJson(200, { items });
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/ads", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:manage");
    const body = readJsonObjectBody(request);
    const database = readMockDatabase();
    const adSet = findRecordInAccount(database.adSets, account.id, String(body.adSetId ?? ""), "ad set");
    const issues: { path: string; message: string }[] = [];
    const creativeInput = validateCreativeInput(body.creative, "creative", account.id, issues);
    throwIfValidationIssues(issues);
    const resolvedCreative = resolveCreativeFromInput(creativeInput, account);
    collectPlacementIssuesForAds([{ creative: resolvedCreative }], adSet.placements, issues);
    throwIfValidationIssues(issues.map((issue) => ({ ...issue, path: issue.path.replace(/^ads\.0\./, "") })));
    const now = readIsoNow();
    const ad: MockAdRecord = {
      id: createMockId("ad"),
      accountId: account.id,
      campaignId: adSet.campaignId,
      adSetId: adSet.id,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "New ad",
      status: "draft",
      review: { status: "not_submitted", policyCode: null, policyReason: null, reviewedAt: null, appeal: null },
      creative: resolvedCreative,
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    database.ads.push(ad);
    return respondWithJson(201, presentAd(ad));
  });

  registerMockRoute("PATCH", "/ads/accounts/:accountId/ads/:adId", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "campaigns:manage");
    const ad = findRecordInAccount(readMockDatabase().ads, account.id, request.params.adId, "ad");
    const body = readJsonObjectBody(request);
    if (typeof body.name === "string" && body.name.trim()) ad.name = body.name.trim().slice(0, 120);
    if (body.creative !== undefined) {
      const issues: { path: string; message: string }[] = [];
      const creativeInput = validateCreativeInput(body.creative, "creative", account.id, issues);
      throwIfValidationIssues(issues);
      const resolvedCreative = resolveCreativeFromInput(creativeInput, account);
      const adSet = findRecordInAccount(readMockDatabase().adSets, account.id, ad.adSetId, "ad set");
      collectPlacementIssuesForAds([{ creative: resolvedCreative }], adSet.placements, issues);
      throwIfValidationIssues(issues.map((issue) => ({ ...issue, path: issue.path.replace(/^ads\.0\./, "") })));
      ad.creative = resolvedCreative;
      if (ad.status !== "draft") markAdAsSubmittedForReview(ad);
    }
    applyStatusChange(ad, body.status);
    ad.updatedAt = readIsoNow();
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "ad_updated", objectType: "ad", objectId: ad.id, objectName: ad.name, summary: body.creative !== undefined && ad.status === "in_review" ? "Edited the creative; sent for review again" : "Edited ad", changes: [] });
    return respondWithJson(200, presentAd(ad));
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/ads/:adId/appeal", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "campaigns:manage");
    const ad = findRecordInAccount(readMockDatabase().ads, account.id, request.params.adId, "ad");
    const message = String(readJsonObjectBody(request).message ?? "").trim();
    if (ad.review.status !== "rejected") throw new MockHttpError(409, "NOT_REJECTED", "Only rejected ads can be appealed.");
    if (ad.review.appeal) throw new MockHttpError(409, "ALREADY_APPEALED", "This decision was already appealed. Edit the ad instead.");
    if (message.length < 20 || message.length > 1000) throw new MockHttpError(400, "VALIDATION_FAILED", "Explain why the ad follows the policy (20–1000 characters).", [{ path: "message", message: "Explain why the ad follows the policy (20–1000 characters)." }]);
    ad.review = { ...ad.review, appeal: { status: "pending", message, submittedAt: readIsoNow(), resolvedAt: null, resolutionNote: null } };
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "ad_appealed", objectType: "ad", objectId: ad.id, objectName: ad.name, summary: "Appealed the review decision", changes: [] });
    return respondWithJson(200, presentAd(ad));
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/content-sources", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const type = request.query.get("type");
    const search = (request.query.get("search") ?? "").trim().toLowerCase();
    const sources = readMockDatabase().contentSources.filter((source) => source.accountId === account.id && (!type || source.type === type) && (!search || `${source.title} ${source.text}`.toLowerCase().includes(search)));
    const page = paginateItems(sources, request, 24);
    return respondWithJson(200, { ...page, items: page.items.map(({ accountId: _accountId, ...source }) => source) });
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/creatives/preview", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const issues: { path: string; message: string }[] = [];
    const creativeInput = validateCreativeInput(request.jsonBody, "creative", account.id, issues);
    throwIfValidationIssues(issues);
    return respondWithJson(200, resolveCreativeFromInput(creativeInput, account));
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/creatives/media/:mediaId", (request) => {
    requireAccountAccess(request, "campaigns:view");
    const stored = readMockDatabase().media.get(request.params.mediaId ?? "");
    if (!stored) throw new MockHttpError(404, "NOT_FOUND", "Media not found.");
    const isReady = Date.now() - stored.createdAtEpochMs > 1200;
    return respondWithJson(200, { mediaId: stored.media.id, status: isReady ? "ready" : "processing", media: isReady ? stored.media : null });
  });
}
