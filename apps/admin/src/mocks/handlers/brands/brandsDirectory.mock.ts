import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, failNotFound, matchesSearchText, paginateByCursor, readIsoNow, readIsoTimeOffset, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockBrandRecord } from "@/mocks/seed/brandsDirectory.mock";
import { presentBrandDetail, presentBrandSummary, readAllowedOfficialActions } from "@/mocks/handlers/brands/brandsPresenters.mock";
import { findBrandRecordOrFail, readBrandsMockStore } from "@/mocks/handlers/brands/brandsStore.mock";
import type { OfficialStoreDecisionAction, OfficialStoreStatus } from "@/types/brands.type";

const nextStatusForAction: Record<OfficialStoreDecisionAction, OfficialStoreStatus> = { approve: "OFFICIAL", reject: "REJECTED", "request-info": "NEEDS_INFO", revoke: "REVOKED" };

function snapshotOfficialState(brand: MockBrandRecord) {
  return { officialStatus: brand.officialStatus, officialBadgeStores: brand.linkedStores.filter((store) => store.hasOfficialBadge).map((store) => store.storeName) };
}

function applyOfficialDecision(request: MockRequest, action: OfficialStoreDecisionAction) {
  const principal = action === "revoke" ? requireMockPermission(request, "brands:revoke") : requireMockPermission(request, "brands:review");
  if (action === "revoke") requireMockStepUp(request);
  const brand = findBrandRecordOrFail(request.params.brandId);
  const reason = readRequiredReason(readJsonObjectBody(request));
  if (!readAllowedOfficialActions(brand).includes(action)) {
    throw new MockHttpError(409, "INVALID_OFFICIAL_STATUS_TRANSITION", `Official Store status is ${brand.officialStatus.toLowerCase().replace("_", " ")}, so "${action}" is not allowed.`);
  }
  const before = snapshotOfficialState(brand);
  brand.officialStatus = nextStatusForAction[action];
  for (const store of brand.linkedStores) {
    if (action === "approve") store.hasOfficialBadge = store.isVerified;
    if (action === "revoke") store.hasOfficialBadge = false;
  }
  if (brand.officialRequest) {
    brand.officialRequest.lastDecisionReason = reason;
    brand.officialRequest.decidedAt = readIsoNow();
    brand.officialRequest.decidedByName = principal.name;
  }
  recordMockAuditEntry(request, { action: `brand.official_${action.replace("-", "_")}`, area: "brands", target: { type: "brand", id: brand.id, label: brand.name }, reason, before, after: snapshotOfficialState(brand) });
  return respondWithJson(200, presentBrandDetail(brand));
}

export function registerBrandDirectoryMockHandlers(): void {
  registerMockRoute("GET", "/admin/brands", (request) => {
    requireMockPermission(request, "brands:review", "brands:revoke", "ip-claims:review");
    const search = request.query.get("search");
    const official = request.query.get("official");
    const country = request.query.get("country");
    const brands = readBrandsMockStore()
      .brands.filter((brand) => matchesSearchText(search, brand.name, brand.slug, brand.category, brand.id) && (!official || brand.officialStatus === official) && (!country || brand.country === country))
      .sort((first, second) => Number(second.officialStatus === "PENDING") - Number(first.officialStatus === "PENDING") || first.name.localeCompare(second.name))
      .map(presentBrandSummary);
    return respondWithJson(200, paginateByCursor(brands, request));
  });

  registerMockRoute("GET", "/admin/brands/:brandId", (request) => {
    requireMockPermission(request, "brands:review", "brands:revoke", "ip-claims:review");
    return respondWithJson(200, presentBrandDetail(findBrandRecordOrFail(request.params.brandId)));
  });

  registerMockRoute("GET", "/admin/brands/:brandId/documents/:documentId", (request) => {
    const principal = requireMockPermission(request, "brands:review");
    const brand = findBrandRecordOrFail(request.params.brandId);
    const document = brand.officialRequest?.documents.find((candidate) => candidate.id === request.params.documentId);
    if (!document) failNotFound("Document");
    recordMockAuditEntry(request, { action: "brand.document_viewed", area: "brands", target: { type: "brand", id: brand.id, label: brand.name }, after: { document: document.label } });
    return respondWithJson(200, {
      documentId: document.id,
      kind: document.kind,
      url: `https://media.example.com/private/brands/${brand.id}/${document.id}?signature=demo&expires=300`,
      expiresAt: readIsoTimeOffset(5),
      watermarkText: `Zudomart Admin — confidential · ${principal.email} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    });
  });

  for (const action of ["approve", "reject", "request-info", "revoke"] as const) {
    registerMockRoute("POST", `/admin/brands/:brandId/official-status/${action}`, (request) => applyOfficialDecision(request, action));
  }
}
