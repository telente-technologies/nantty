import { readMockDatabase, type MockAdRecord, type MockAdSetRecord, type MockCampaignRecord } from "@/mocks/mockDatabase.mock";
import { createMockId, readIsoNow } from "@/mocks/mockResponses.mock";
import { markAdAsSubmittedForReview } from "@/mocks/mockReviewQueue.mock";
import type { BulkAction, DeliveryStatus } from "@/types/campaign.type";

type Level = "campaign" | "ad_set" | "ad";
type DeliveryRecord = MockCampaignRecord | MockAdSetRecord | MockAdRecord;

interface BulkOutcome {
  readonly succeededIds: string[];
  readonly failed: { id: string; message: string }[];
  readonly createdIds: string[];
}

const draftReview = { status: "not_submitted" as const, policyCode: null, policyReason: null, reviewedAt: null, appeal: null };

function copyAd(ad: MockAdRecord, overrides: Partial<MockAdRecord>): MockAdRecord {
  const now = readIsoNow();
  return { ...ad, id: createMockId("ad"), name: `${ad.name} (copy)`, status: "draft", review: draftReview, submittedAt: null, createdAt: now, updatedAt: now, ...overrides };
}

function copyAdSetWithAds(adSet: MockAdSetRecord, campaignId: string, nameSuffix: string): string {
  const database = readMockDatabase();
  const now = readIsoNow();
  const adSetCopy: MockAdSetRecord = { ...adSet, id: createMockId("ads"), campaignId, name: `${adSet.name}${nameSuffix}`, status: "draft", experimentId: null, createdAt: now, updatedAt: now };
  database.adSets.push(adSetCopy);
  for (const ad of database.ads.filter((candidate) => candidate.adSetId === adSet.id)) database.ads.push(copyAd(ad, { campaignId, adSetId: adSetCopy.id, name: ad.name }));
  return adSetCopy.id;
}

function duplicateRecord(level: Level, record: DeliveryRecord): string {
  const database = readMockDatabase();
  if (level === "campaign") {
    const campaign = record as MockCampaignRecord;
    const now = readIsoNow();
    const copy: MockCampaignRecord = { ...campaign, id: createMockId("cmp"), name: `${campaign.name} (copy)`, status: "draft", createdAt: now, updatedAt: now };
    database.campaigns.push(copy);
    for (const adSet of database.adSets.filter((candidate) => candidate.campaignId === campaign.id)) copyAdSetWithAds(adSet, copy.id, "");
    return copy.id;
  }
  if (level === "ad_set") {
    const adSet = record as MockAdSetRecord;
    return copyAdSetWithAds(adSet, adSet.campaignId, " (copy)");
  }
  const copy = copyAd(record as MockAdRecord, {});
  database.ads.push(copy);
  return copy.id;
}

function readAdsUnder(level: Level, id: string): MockAdRecord[] {
  const database = readMockDatabase();
  if (level === "campaign") return database.ads.filter((ad) => ad.campaignId === id);
  if (level === "ad_set") return database.ads.filter((ad) => ad.adSetId === id);
  return database.ads.filter((ad) => ad.id === id);
}

function changeDeliveryStatus(record: DeliveryRecord, action: BulkAction): string | null {
  const allowedFrom: Record<string, readonly DeliveryStatus[]> = { pause: ["active"], resume: ["paused"], archive: ["active", "paused", "draft", "rejected"] };
  const nextStatus: Record<string, DeliveryStatus> = { pause: "paused", resume: "active", archive: "completed" };
  if (!allowedFrom[action]?.includes(record.status)) return `Cannot ${action} while ${record.status.replace("_", " ")}.`;
  record.status = nextStatus[action] as DeliveryStatus;
  record.updatedAt = readIsoNow();
  return null;
}

export function applyBulkActionToRecords(accountId: string, level: Level, ids: readonly string[], action: BulkAction): BulkOutcome {
  const database = readMockDatabase();
  const collection: DeliveryRecord[] = level === "campaign" ? database.campaigns : level === "ad_set" ? database.adSets : database.ads;
  const outcome: BulkOutcome = { succeededIds: [], failed: [], createdIds: [] };
  for (const id of ids) {
    const record = collection.find((candidate) => candidate.id === id && candidate.accountId === accountId);
    if (!record) {
      outcome.failed.push({ id, message: "Not found in this ad account." });
      continue;
    }
    if (action === "duplicate") {
      outcome.createdIds.push(duplicateRecord(level, record));
      outcome.succeededIds.push(id);
      continue;
    }
    if (action === "submit_for_review") {
      const adsToSubmit = readAdsUnder(level, id).filter((ad) => ad.status === "draft" || ad.status === "rejected");
      if (adsToSubmit.length === 0) {
        outcome.failed.push({ id, message: "No draft or rejected ads to submit." });
        continue;
      }
      adsToSubmit.forEach(markAdAsSubmittedForReview);
      if (record.status === "draft" || record.status === "rejected") record.status = "in_review";
      outcome.succeededIds.push(id);
      continue;
    }
    const failure = changeDeliveryStatus(record, action);
    if (failure) outcome.failed.push({ id, message: failure });
    else outcome.succeededIds.push(id);
  }
  return outcome;
}
