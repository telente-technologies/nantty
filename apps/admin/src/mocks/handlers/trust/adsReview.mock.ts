import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, failValidation, matchesSearchText, paginateItems, readJsonObjectBody, readOptionalTrimmedString, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockAdRecord } from "@/mocks/seed/trustAds.mock";
import type { AdForReview, AdForReviewDetail } from "@/types/adsReview.type";

import { findRecordByIdOrFail, readTrustStore } from "./trustStore.mock";

function presentAdForReview(record: MockAdRecord): AdForReview {
  const { advertiserId, ...ad } = record;
  const advertiser = findRecordByIdOrFail(readTrustStore().advertisers, advertiserId, "Advertiser");
  return { ...ad, advertiser: { id: advertiser.id, name: advertiser.name, status: advertiser.status } };
}

function presentAdForReviewDetail(record: MockAdRecord): AdForReviewDetail {
  return { ...presentAdForReview(record), history: listMockAuditEntriesForTarget("ad", record.id) };
}

function findPendingAdOrFail(request: MockRequest): MockAdRecord {
  const record = findRecordByIdOrFail(readTrustStore().ads, request.params.adId, "Ad");
  if (record.status !== "PENDING") throw new MockHttpError(409, "AD_ALREADY_REVIEWED", "This ad was already reviewed. Reload to see the decision.");
  return record;
}

function auditTargetForAd(record: MockAdRecord) {
  return { type: "ad", id: record.id, label: record.campaignName };
}

export function registerAdsReviewMockHandlers(): void {
  registerMockRoute("GET", "/admin/ads", (request) => {
    requireMockPermission(request, "ads:review", "advertisers:manage");
    const status = request.query.get("status") ?? "PENDING";
    const advertiserId = request.query.get("advertiserId");
    const search = request.query.get("search");
    const ads = readTrustStore()
      .ads.filter((record) => (status === "ALL" || record.status === status) && (!advertiserId || record.advertiserId === advertiserId))
      .filter((record) => matchesSearchText(search, record.id, record.campaignName, record.creative.headline, findRecordByIdOrFail(readTrustStore().advertisers, record.advertiserId, "Advertiser").name))
      .sort((first, second) => second.autoCheckFlags.length - first.autoCheckFlags.length || first.submittedAt.localeCompare(second.submittedAt))
      .map(presentAdForReview);
    return respondWithJson(200, paginateItems(ads, request));
  });

  registerMockRoute("GET", "/admin/ads/:adId", (request) => {
    requireMockPermission(request, "ads:review", "advertisers:manage");
    return respondWithJson(200, presentAdForReviewDetail(findRecordByIdOrFail(readTrustStore().ads, request.params.adId, "Ad")));
  });

  registerMockRoute("POST", "/admin/ads/:adId/approve", (request) => {
    requireMockPermission(request, "ads:review");
    const body = readJsonObjectBody(request);
    const note = readOptionalTrimmedString(body, "reason", 1000) ?? "Creative and landing page comply with ad policies.";
    const record = findPendingAdOrFail(request);
    const advertiser = findRecordByIdOrFail(readTrustStore().advertisers, record.advertiserId, "Advertiser");
    if (advertiser.status === "SUSPENDED") throw new MockHttpError(409, "ADVERTISER_SUSPENDED", "This advertiser is suspended. Reinstate the account before approving its ads.");
    const unresolvedCriticalFlag = record.autoCheckFlags.find((flag) => flag.severity === "CRITICAL");
    if (unresolvedCriticalFlag && body.overrideCriticalFlags !== true) throw new MockHttpError(409, "CRITICAL_FLAG_UNRESOLVED", `Auto-check flagged "${unresolvedCriticalFlag.label}". Confirm the override to approve anyway.`);
    const before = { status: record.status };
    record.status = "APPROVED";
    record.decision = { policyCategoryId: null, reason: note, decidedByName: request.principal?.name ?? "System", decidedAt: new Date().toISOString() };
    recordMockAuditEntry(request, { action: "ad.approved", area: "ads", target: auditTargetForAd(record), reason: note, before, after: { status: record.status, overrodeCriticalFlags: Boolean(unresolvedCriticalFlag) } });
    return respondWithJson(200, presentAdForReviewDetail(record));
  });

  registerMockRoute("POST", "/admin/ads/:adId/reject", (request) => {
    requireMockPermission(request, "ads:review");
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const policy = readTrustStore().adPolicies.find((candidate) => candidate.id === body.policyCategoryId && candidate.isActive);
    if (!policy) failValidation("policyCategoryId", "Choose the policy this ad breaks.");
    const record = findPendingAdOrFail(request);
    const advertiser = findRecordByIdOrFail(readTrustStore().advertisers, record.advertiserId, "Advertiser");
    const before = { status: record.status, advertiserViolations: advertiser.violationCount };
    record.status = "REJECTED";
    record.decision = { policyCategoryId: policy.id, reason, decidedByName: request.principal?.name ?? "System", decidedAt: new Date().toISOString() };
    policy.rejectionCount += 1;
    advertiser.violationCount += 1;
    advertiser.lastViolationAt = record.decision.decidedAt;
    recordMockAuditEntry(request, { action: "ad.rejected", area: "ads", target: auditTargetForAd(record), reason, before, after: { status: record.status, policy: policy.name, advertiserViolations: advertiser.violationCount } });
    return respondWithJson(200, presentAdForReviewDetail(record));
  });

  registerMockRoute("POST", "/admin/ads/:adId/appeal/resolve", (request) => {
    requireMockPermission(request, "ads:review");
    const body = readJsonObjectBody(request);
    const decision = body.decision === "uphold" || body.decision === "overturn" ? body.decision : failValidation("decision", "Choose uphold or overturn.");
    const note = readRequiredTrimmedString(body, "note", 1000, 5);
    const record = findRecordByIdOrFail(readTrustStore().ads, request.params.adId, "Ad");
    const before = { status: record.status };
    if (decision === "overturn") record.status = "APPROVED";
    record.decision = {
      policyCategoryId: decision === "uphold" ? (record.decision?.policyCategoryId ?? null) : null,
      reason: note,
      decidedByName: request.principal?.name ?? "System",
      decidedAt: new Date().toISOString(),
    };
    recordMockAuditEntry(request, { action: `ad.appeal.${decision}`, area: "ads", target: auditTargetForAd(record), reason: note, before, after: { status: record.status } });
    return respondWithJson(200, presentAdForReviewDetail(record));
  });
}
