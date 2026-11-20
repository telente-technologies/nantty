import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, matchesSearchText, paginateItems, readEnumValue, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { MockAdvertiserRecord } from "@/mocks/seed/trustAds.mock";
import type { AdFrequencyPolicy, AdvertiserAccount, PolicySeverity } from "@/types/adsReview.type";

import { findRecordByIdOrFail, presentModeratedUser, readTrustStore } from "./trustStore.mock";

const policySeverities: readonly PolicySeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function presentAdvertiserAccount(record: MockAdvertiserRecord): AdvertiserAccount {
  const { ownerUserId, ...advertiser } = record;
  return { ...advertiser, owner: presentModeratedUser(ownerUserId) };
}

export function registerAdvertiserAccountMockHandlers(): void {
  registerMockRoute("GET", "/admin/advertisers", (request) => {
    requireMockPermission(request, "advertisers:manage", "ads:review");
    const status = request.query.get("status");
    const search = request.query.get("search");
    const advertisers = readTrustStore()
      .advertisers.filter((record) => (!status || record.status === status) && matchesSearchText(search, record.id, record.name))
      .sort((first, second) => second.violationCount - first.violationCount)
      .map(presentAdvertiserAccount);
    return respondWithJson(200, paginateItems(advertisers, request));
  });

  registerMockRoute("GET", "/admin/advertisers/:advertiserId", (request) => {
    requireMockPermission(request, "advertisers:manage", "ads:review");
    const record = findRecordByIdOrFail(readTrustStore().advertisers, request.params.advertiserId, "Advertiser");
    return respondWithJson(200, { ...presentAdvertiserAccount(record), history: listMockAuditEntriesForTarget("advertiser", record.id) });
  });

  for (const action of ["suspend", "reinstate"] as const) {
    registerMockRoute("POST", `/admin/advertisers/:advertiserId/${action}`, (request) => {
      requireMockPermission(request, "advertisers:manage");
      const reason = readRequiredReason(readJsonObjectBody(request));
      const record = findRecordByIdOrFail(readTrustStore().advertisers, request.params.advertiserId, "Advertiser");
      const nextStatus = action === "suspend" ? "SUSPENDED" : "ACTIVE";
      if (record.status === nextStatus) throw new MockHttpError(409, "ADVERTISER_STATE_UNCHANGED", `This advertiser is already ${nextStatus.toLowerCase()}.`);
      const before = { status: record.status, activeCampaigns: record.activeCampaigns };
      record.status = nextStatus;
      if (action === "suspend") record.activeCampaigns = 0;
      recordMockAuditEntry(request, { action: `advertiser.${action === "suspend" ? "suspended" : "reinstated"}`, area: "ads", target: { type: "advertiser", id: record.id, label: record.name }, reason, before, after: { status: record.status, activeCampaigns: record.activeCampaigns } });
      return respondWithJson(200, { ...presentAdvertiserAccount(record), history: listMockAuditEntriesForTarget("advertiser", record.id) });
    });
  }

  registerMockRoute("GET", "/admin/ad-policies", (request) => {
    requireMockPermission(request, "advertisers:manage", "ads:review");
    return respondWithJson(200, { items: readTrustStore().adPolicies });
  });

  registerMockRoute("POST", "/admin/ad-policies", (request) => {
    requireMockPermission(request, "advertisers:manage");
    const body = readJsonObjectBody(request);
    const name = readRequiredTrimmedString(body, "name", 60, 3);
    if (readTrustStore().adPolicies.some((policy) => policy.name.toLowerCase() === name.toLowerCase())) throw new MockHttpError(409, "POLICY_EXISTS", "A policy category with this name already exists.");
    const policy = { id: createMockId("pol"), name, description: readRequiredTrimmedString(body, "description", 400, 10), severity: readEnumValue(body, "severity", policySeverities), isActive: true, rejectionCount: 0 };
    readTrustStore().adPolicies.push(policy);
    recordMockAuditEntry(request, { action: "ad_policy.created", area: "ads", target: { type: "adPolicy", id: policy.id, label: policy.name }, before: null, after: policy });
    return respondWithJson(201, policy);
  });

  registerMockRoute("PUT", "/admin/ad-policies/:policyId", (request) => {
    requireMockPermission(request, "advertisers:manage");
    const body = readJsonObjectBody(request);
    const policy = findRecordByIdOrFail(readTrustStore().adPolicies, request.params.policyId, "Policy category");
    const before = { ...policy };
    policy.name = readRequiredTrimmedString(body, "name", 60, 3);
    policy.description = readRequiredTrimmedString(body, "description", 400, 10);
    policy.severity = readEnumValue(body, "severity", policySeverities);
    policy.isActive = body.isActive !== false;
    recordMockAuditEntry(request, { action: "ad_policy.updated", area: "ads", target: { type: "adPolicy", id: policy.id, label: policy.name }, reason: readRequiredReason(body), before, after: { ...policy } });
    return respondWithJson(200, policy);
  });

  const frequencyPolicies: AdFrequencyPolicy[] = [
    { format: "feed", sessionCap: 3, hourCap: 6, dayCap: 18, advertiserDayCap: 3, minGapSlots: 4, cooldownSecondsAfterSkip: 120, active: true },
    { format: "clips", sessionCap: 2, hourCap: 5, dayCap: 15, advertiserDayCap: 2, minGapSlots: 5, cooldownSecondsAfterSkip: 180, active: true },
    { format: "stories", sessionCap: 2, hourCap: 4, dayCap: 12, advertiserDayCap: 2, minGapSlots: 4, cooldownSecondsAfterSkip: 120, active: true },
  ];

  registerMockRoute("GET", "/admin/ads-policies", (request) => {
    requireMockPermission(request, "config:revenue", "ads:review");
    return respondWithJson(200, { frequency: frequencyPolicies });
  });

  registerMockRoute("PUT", "/admin/ads-policies/frequency/:format", (request) => {
    requireMockPermission(request, "config:revenue");
    const body = readJsonObjectBody(request) as Partial<AdFrequencyPolicy>;
    const format = request.params.format ?? "";
    const existingIndex = frequencyPolicies.findIndex((item) => item.format === format);
    const updated: AdFrequencyPolicy = {
      format,
      sessionCap: Number(body.sessionCap ?? 3),
      hourCap: Number(body.hourCap ?? 6),
      dayCap: Number(body.dayCap ?? 18),
      advertiserDayCap: Number(body.advertiserDayCap ?? 3),
      minGapSlots: Number(body.minGapSlots ?? 4),
      cooldownSecondsAfterSkip: Number(body.cooldownSecondsAfterSkip ?? 120),
      active: body.active !== false,
    };
    if (existingIndex >= 0) frequencyPolicies[existingIndex] = updated;
    else frequencyPolicies.push(updated);
    recordMockAuditEntry(request, { action: "ad_frequency_policy.updated", area: "ads", target: { type: "adFrequencyPolicy", id: format, label: format }, before: null, after: updated });
    return { status: 204, body: undefined };
  });
}
