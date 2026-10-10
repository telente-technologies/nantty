import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, matchesSearchText, paginateByCursor, readIsoNow, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { asMutablePlatformUser, readUserExtrasForPeople } from "@/mocks/handlers/people/peopleStore.mock";
import type { MockIpClaimRecord } from "@/mocks/seed/brandsIpClaims.mock";
import { presentIpClaimDetail, presentIpClaimSummary, readAllowedIpClaimActions } from "@/mocks/handlers/brands/brandsPresenters.mock";
import { findIpClaimRecordOrFail, readBrandsMockStore } from "@/mocks/handlers/brands/brandsStore.mock";
import type { IpClaimDecisionAction } from "@/types/ipClaims.type";

export const repeatInfringerStrikeThreshold = 3;

function snapshotClaimState(claim: MockIpClaimRecord, sellerStrikeCount: number) {
  return { status: claim.status, listingStatus: claim.listing.status, sellerStrikeCount };
}

function addIntellectualPropertyStrikeToSeller(claim: MockIpClaimRecord, reason: string, issuedByName: string): number {
  const seller = readMockDatabase().platformUsers.find((candidate) => candidate.id === claim.accusedSellerUserId);
  if (!seller) return 0;
  const extras = readUserExtrasForPeople(seller.id) as { strikes: unknown[] };
  extras.strikes.unshift({ id: createMockId("stk"), policy: claim.type === "COUNTERFEIT" ? "Counterfeit goods" : "Trademark infringement", reason, source: "MODERATION", issuedAt: readIsoNow(), expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(), issuedByName });
  const mutableSeller = asMutablePlatformUser(seller);
  mutableSeller.strikeCount += 1;
  return mutableSeller.strikeCount;
}

function applyIpClaimDecision(request: MockRequest, action: IpClaimDecisionAction) {
  const principal = requireMockPermission(request, "ip-claims:review");
  if (action === "uphold") requireMockStepUp(request);
  const claim = findIpClaimRecordOrFail(request.params.claimId);
  const body = readJsonObjectBody(request);
  const reason = readRequiredReason(body);
  if (!readAllowedIpClaimActions(claim).includes(action)) {
    throw new MockHttpError(409, "INVALID_CLAIM_TRANSITION", `This claim is ${claim.status.toLowerCase().replace("_", " ")}, so "${action}" is not allowed.`);
  }
  const seller = readMockDatabase().platformUsers.find((candidate) => candidate.id === claim.accusedSellerUserId);
  const before = snapshotClaimState(claim, seller?.strikeCount ?? 0);
  const shouldAddStrike = action === "uphold" && body.addStrike !== false;
  let sellerStrikeCount = seller?.strikeCount ?? 0;
  if (action === "uphold") {
    claim.status = "UPHELD";
    claim.listing.status = "DELISTED";
    if (shouldAddStrike) sellerStrikeCount = addIntellectualPropertyStrikeToSeller(claim, reason, principal.name);
  } else {
    claim.status = action === "reject" ? "REJECTED" : "NEEDS_INFO";
  }
  claim.decision = { outcome: claim.status === "UPHELD" ? "UPHELD" : claim.status === "REJECTED" ? "REJECTED" : "NEEDS_INFO", reason, decidedAt: readIsoNow(), decidedByName: principal.name, strikeAdded: shouldAddStrike };
  recordMockAuditEntry(request, { action: `ip_claim.${action.replace("-", "_")}`, area: "brands", target: { type: "ipClaim", id: claim.id, label: claim.listing.title }, reason, before, after: snapshotClaimState(claim, sellerStrikeCount) });
  return respondWithJson(200, { claim: presentIpClaimDetail(claim), sellerStrikeCount, isRepeatInfringer: sellerStrikeCount >= repeatInfringerStrikeThreshold });
}

export function registerIpClaimMockHandlers(): void {
  registerMockRoute("GET", "/admin/ip-claims", (request) => {
    requireMockPermission(request, "ip-claims:review");
    const search = request.query.get("search");
    const status = request.query.get("status");
    const type = request.query.get("type");
    const claims = readBrandsMockStore()
      .claims.map((claim) => presentIpClaimSummary(claim))
      .filter((claim) => matchesSearchText(search, claim.id, claim.listing.title, claim.claimantBrand.name, claim.accusedSeller.username) && (!status || status === "ALL" || claim.status === status) && (!type || claim.type === type))
      .sort((first, second) => first.slaDueAt.localeCompare(second.slaDueAt));
    return respondWithJson(200, paginateByCursor(claims, request));
  });

  registerMockRoute("GET", "/admin/ip-claims/:claimId", (request) => {
    requireMockPermission(request, "ip-claims:review");
    return respondWithJson(200, presentIpClaimDetail(findIpClaimRecordOrFail(request.params.claimId)));
  });

  for (const action of ["uphold", "reject", "request-info"] as const) {
    registerMockRoute("POST", `/admin/ip-claims/:claimId/${action}`, (request) => applyIpClaimDecision(request, action));
  }
}
