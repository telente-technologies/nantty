import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { createMockId, failConflict, failNotFound, failValidation, readEnumValue, readIsoNow, readJsonObjectBody, readOptionalTrimmedString, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockMartHomeFeatureRecord } from "@/mocks/seed/catalogSeed.mock";
import type { MartHomeFeature, MartHomeFeatureStatus } from "@/types/catalog.type";

import { readCatalogMockStore } from "./contentStores.mock";

const featureKinds = ["HERO_BANNER", "PROMO_BANNER", "FEATURED_COLLECTION", "FEATURED_STORE"] as const;
const targetTypes = ["CATEGORY", "COLLECTION", "STORE", "PRODUCT", "URL"] as const;
const supportedCountries = ["NG", "GH", "KE", "ZA", "GB", "US"];

function computeFeatureStatus(record: MockMartHomeFeatureRecord, nowEpochMs = Date.now()): MartHomeFeatureStatus {
  if (!record.isPublished) return "DRAFT";
  if (record.endsAt && new Date(record.endsAt).getTime() <= nowEpochMs) return "EXPIRED";
  if (new Date(record.startsAt).getTime() > nowEpochMs) return "SCHEDULED";
  return "LIVE";
}

export function presentMartHomeFeature(record: MockMartHomeFeatureRecord): MartHomeFeature {
  const image = readCatalogMockStore().imageLibrary.find((option) => option.id === record.imageId);
  return { ...record, imageUrl: image?.url ?? "", status: computeFeatureStatus(record) };
}

function findFeatureOrFail(featureId: string | undefined): MockMartHomeFeatureRecord {
  const feature = readCatalogMockStore().features.find((candidate) => candidate.id === featureId);
  if (!feature) failNotFound("Mart home feature");
  return feature;
}

function listFeaturesByPriority(): MockMartHomeFeatureRecord[] {
  return [...readCatalogMockStore().features].sort((first, second) => first.priority - second.priority);
}

function readIsoDateOrFail(body: Record<string, unknown>, fieldName: string, isRequired: boolean): string | null {
  const value = body[fieldName];
  if ((value === undefined || value === null || value === "") && !isRequired) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) failValidation(fieldName, `${fieldName} must be a date and time.`);
  return new Date(value).toISOString();
}

function readFeatureFields(body: Record<string, unknown>, existing: MockMartHomeFeatureRecord | null) {
  const pick = <Value>(fieldName: string, read: () => Value, fallback: Value | undefined): Value => (existing && body[fieldName] === undefined ? (fallback as Value) : read());
  const title = pick("title", () => readRequiredTrimmedString(body, "title", 60, 3), existing?.title);
  const subtitle = pick("subtitle", () => readOptionalTrimmedString(body, "subtitle", 90), existing?.subtitle);
  const kind = pick("kind", () => readEnumValue(body, "kind", featureKinds), existing?.kind);
  const imageId = pick("imageId", () => readRequiredTrimmedString(body, "imageId", 60), existing?.imageId);
  if (!readCatalogMockStore().imageLibrary.some((option) => option.id === imageId)) failValidation("imageId", "Choose an image from the approved library.");
  const targetType = pick("targetType", () => readEnumValue(body, "targetType", targetTypes), existing?.targetType);
  const targetValue = pick("targetValue", () => readRequiredTrimmedString(body, "targetValue", 200), existing?.targetValue);
  if (targetType === "URL" && !/^https:\/\/([a-z0-9-]+\.)*(?:nantty|zudomart)\.com(\/|$)/.test(targetValue)) failValidation("targetValue", "Links must be https:// addresses on Nantty.");
  const countries = pick("countries", () => {
    const value = body.countries;
    if (!Array.isArray(value) || value.length === 0 || value.some((country) => typeof country !== "string" || !supportedCountries.includes(country))) failValidation("countries", "Choose at least one supported country.");
    return [...new Set(value as string[])];
  }, existing?.countries);
  const startsAt = pick("startsAt", () => readIsoDateOrFail(body, "startsAt", true) as string, existing?.startsAt);
  const endsAt = pick("endsAt", () => readIsoDateOrFail(body, "endsAt", false), existing?.endsAt);
  if (endsAt && endsAt <= startsAt) failValidation("endsAt", "The end must be after the start.");
  return { title, subtitle, kind, imageId, targetType, targetValue, countries, startsAt, endsAt };
}

function saveFeature(updated: MockMartHomeFeatureRecord): void {
  const store = readCatalogMockStore();
  store.features = store.features.map((feature) => (feature.id === updated.id ? updated : feature));
}

function auditTargetForFeature(feature: MockMartHomeFeatureRecord) {
  return { type: "martHomeFeature", id: feature.id, label: feature.title };
}

function requireCatalogPermission(request: MockRequest) {
  return requireMockPermission(request, "catalog:manage");
}

export function registerCatalogFeatureMockHandlers(): void {
  registerMockRoute("GET", "/admin/catalog/features", (request) => {
    requireCatalogPermission(request);
    return respondWithJson(200, { items: listFeaturesByPriority().map(presentMartHomeFeature) });
  });

  registerMockRoute("GET", "/admin/catalog/features/image-library", (request) => {
    requireCatalogPermission(request);
    return respondWithJson(200, { items: readCatalogMockStore().imageLibrary, countries: supportedCountries });
  });

  registerMockRoute("GET", "/admin/catalog/features/:featureId", (request) => {
    requireCatalogPermission(request);
    const feature = findFeatureOrFail(request.params.featureId);
    return respondWithJson(200, { item: presentMartHomeFeature(feature), history: listMockAuditEntriesForTarget("martHomeFeature", feature.id) });
  });

  registerMockRoute("POST", "/admin/catalog/features", (request) => {
    requireCatalogPermission(request);
    const body = readJsonObjectBody(request);
    const fields = readFeatureFields(body, null);
    const reason = readRequiredReason(body);
    const feature: MockMartHomeFeatureRecord = { id: createMockId("feat"), ...fields, priority: readCatalogMockStore().features.length + 1, isPublished: false, updatedAt: readIsoNow() };
    readCatalogMockStore().features.push(feature);
    recordMockAuditEntry(request, { action: "catalog.feature_created", area: "catalog", target: auditTargetForFeature(feature), reason, before: null, after: feature });
    return respondWithJson(201, { item: presentMartHomeFeature(feature) });
  });

  registerMockRoute("PATCH", "/admin/catalog/features/:featureId", (request) => {
    requireCatalogPermission(request);
    const before = findFeatureOrFail(request.params.featureId);
    const body = readJsonObjectBody(request);
    const fields = readFeatureFields(body, before);
    const reason = readRequiredReason(body);
    const updated: MockMartHomeFeatureRecord = { ...before, ...fields, updatedAt: readIsoNow() };
    saveFeature(updated);
    recordMockAuditEntry(request, { action: "catalog.feature_updated", area: "catalog", target: auditTargetForFeature(updated), reason, before, after: updated });
    return respondWithJson(200, { item: presentMartHomeFeature(updated) });
  });

  for (const action of ["publish", "unpublish"] as const) {
    registerMockRoute("POST", `/admin/catalog/features/:featureId/${action}`, (request) => {
      requireCatalogPermission(request);
      const before = findFeatureOrFail(request.params.featureId);
      const reason = readRequiredReason(readJsonObjectBody(request));
      const isPublished = action === "publish";
      if (before.isPublished === isPublished) failConflict("NO_CHANGE", `This feature is already ${isPublished ? "published" : "a draft"}.`);
      const updated = { ...before, isPublished, updatedAt: readIsoNow() };
      saveFeature(updated);
      recordMockAuditEntry(request, { action: `catalog.feature_${action}ed`, area: "catalog", target: auditTargetForFeature(updated), reason, before: { isPublished: before.isPublished, status: computeFeatureStatus(before) }, after: { isPublished, status: computeFeatureStatus(updated) } });
      return respondWithJson(200, { item: presentMartHomeFeature(updated) });
    });
  }

  registerMockRoute("POST", "/admin/catalog/features/:featureId/move", (request) => {
    requireCatalogPermission(request);
    const feature = findFeatureOrFail(request.params.featureId);
    const direction = readEnumValue(readJsonObjectBody(request), "direction", ["up", "down"] as const);
    const ordered = listFeaturesByPriority();
    const index = ordered.findIndex((candidate) => candidate.id === feature.id);
    const neighbour = ordered[direction === "up" ? index - 1 : index + 1];
    if (!neighbour) failConflict("CANNOT_MOVE", `This feature is already ${direction === "up" ? "first" : "last"}.`);
    saveFeature({ ...feature, priority: neighbour.priority });
    saveFeature({ ...neighbour, priority: feature.priority });
    recordMockAuditEntry(request, { action: "catalog.feature_reordered", area: "catalog", target: auditTargetForFeature(feature), before: { priority: feature.priority }, after: { priority: neighbour.priority } });
    return respondWithJson(200, { items: listFeaturesByPriority().map(presentMartHomeFeature) });
  });
}
