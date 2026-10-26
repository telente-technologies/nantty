import { listMockAuditEntriesForTarget } from "@/mocks/mockAudit.mock";
import { findMockPlatformUser } from "@/mocks/mockDatabase.mock";
import { readUserExtrasForPeople } from "@/mocks/handlers/people/peopleStore.mock";
import { buildUnsplashImageUrl } from "@/mocks/seed/unsplashPhotoIds.mock";
import { presentPlatformUserSummary } from "@/mocks/seed/demoPlatformUsers.mock";
import type { MockBrandOfficialRequest, MockBrandRecord } from "@/mocks/seed/brandsDirectory.mock";
import type { MockIpClaimRecord } from "@/mocks/seed/brandsIpClaims.mock";
import { readBrandsMockStore } from "@/mocks/handlers/brands/brandsStore.mock";
import type { BrandDetail, BrandSummary, OfficialStoreAutomatedCheck, OfficialStoreDecisionAction, OfficialStoreRequest } from "@/types/brands.type";
import type { IpClaimDecisionAction, IpClaimDetail, IpClaimSummary } from "@/types/ipClaims.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

function presentUserById(userId: string): PlatformUserSummary | null {
  const user = findMockPlatformUser(userId);
  return user ? presentPlatformUserSummary(user) : null;
}

function presentUserByIdOrFail(userId: string): PlatformUserSummary {
  const user = presentUserById(userId);
  if (!user) throw new Error(`Unknown mock user ${userId}`);
  return user;
}

function normalizeCompanyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\b(limited|ltd|plc|enterprises|ventures|nigeria|ghana)\b/g, "").replace(/\s+/g, " ").trim();
}

function readHostWithoutWww(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function buildOfficialStoreAutomatedChecks(brand: MockBrandRecord, request: MockBrandOfficialRequest): OfficialStoreAutomatedCheck[] {
  const registrationPattern = /^[A-Z]{2}\/TM\/(O\/)?\d{4}\/\d{5}$/;
  const daysUntilExpiry = Math.floor((new Date(request.trademark.expiresOn).getTime() - Date.now()) / 86_400_000);
  const emailDomain = request.contactEmail.split("@")[1] ?? "";
  const websiteHost = brand.website ? readHostWithoutWww(brand.website) : "";
  const hasVerifiedStore = brand.linkedStores.some((store) => store.isVerified);
  return [
    registrationPattern.test(request.trademark.registrationNumber)
      ? { key: "registrationFormat", label: "Registration number format", outcome: "PASS", detail: `${request.trademark.registrationNumber} matches the ${request.trademark.jurisdiction} format.` }
      : { key: "registrationFormat", label: "Registration number format", outcome: "WARN", detail: `${request.trademark.registrationNumber} is not a recognised format. Check it with the registry by hand.` },
    daysUntilExpiry < 0
      ? { key: "trademarkExpiry", label: "Trademark in force", outcome: "FAIL", detail: `Expired ${Math.abs(daysUntilExpiry)} days ago (${request.trademark.expiresOn}).` }
      : { key: "trademarkExpiry", label: "Trademark in force", outcome: daysUntilExpiry < 90 ? "WARN" : "PASS", detail: `Valid until ${request.trademark.expiresOn}.` },
    normalizeCompanyName(request.trademark.registeredOwner) === normalizeCompanyName(request.cacCompanyName)
      ? { key: "ownerMatchesCac", label: "Trademark owner matches CAC", outcome: "PASS", detail: `${request.cacCompanyName} (${request.cacRegistrationNumber}).` }
      : { key: "ownerMatchesCac", label: "Trademark owner matches CAC", outcome: "FAIL", detail: `Trademark owner "${request.trademark.registeredOwner}" differs from CAC name "${request.cacCompanyName}".` },
    !websiteHost
      ? { key: "emailDomain", label: "Contact email on brand domain", outcome: "WARN", detail: "The brand has no website to compare with." }
      : emailDomain === websiteHost || emailDomain.endsWith(`.${websiteHost}`)
        ? { key: "emailDomain", label: "Contact email on brand domain", outcome: "PASS", detail: `${request.contactEmail} is on ${websiteHost}.` }
        : { key: "emailDomain", label: "Contact email on brand domain", outcome: "FAIL", detail: `${request.contactEmail} is not on ${websiteHost}.` },
    { key: "verifiedStore", label: "Linked store is Gold verified", outcome: hasVerifiedStore ? "PASS" : "WARN", detail: hasVerifiedStore ? "At least one linked store holds Gold verification." : "No linked store is Gold verified yet; the badge will show once one is." },
  ];
}

export function readAllowedOfficialActions(brand: MockBrandRecord): OfficialStoreDecisionAction[] {
  if (brand.officialStatus === "PENDING") return ["approve", "reject", "request-info"];
  if (brand.officialStatus === "NEEDS_INFO") return ["approve", "reject"];
  if (brand.officialStatus === "OFFICIAL") return ["revoke"];
  return [];
}

export function readAllowedIpClaimActions(claim: MockIpClaimRecord): IpClaimDecisionAction[] {
  if (claim.status === "OPEN") return ["uphold", "reject", "request-info"];
  if (claim.status === "NEEDS_INFO") return ["uphold", "reject"];
  return [];
}

function presentOfficialRequest(brand: MockBrandRecord, request: MockBrandOfficialRequest): OfficialStoreRequest {
  const { submittedByUserId, ...rest } = request;
  return { ...rest, submittedBy: presentUserById(submittedByUserId), checks: buildOfficialStoreAutomatedChecks(brand, request) };
}

export function presentBrandSummary(brand: MockBrandRecord): BrandSummary {
  const owner = brand.members.find((member) => member.role === "OWNER");
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoPhotoId ? buildUnsplashImageUrl(brand.logoPhotoId, 120) : null,
    category: brand.category,
    country: brand.country,
    website: brand.website,
    status: brand.status,
    officialStatus: brand.officialStatus,
    owner: owner ? presentUserById(owner.userId) : null,
    memberCount: brand.members.length,
    linkedStoreCount: brand.linkedStores.length,
    openClaimCount: readBrandsMockStore().claims.filter((claim) => claim.claimantBrandId === brand.id && (claim.status === "OPEN" || claim.status === "NEEDS_INFO")).length,
    createdAt: brand.createdAt,
    officialRequestSubmittedAt: brand.officialRequest?.submittedAt ?? null,
  };
}

export function presentIpClaimSummary(claim: MockIpClaimRecord): IpClaimSummary {
  const brand = readBrandsMockStore().brands.find((candidate) => candidate.id === claim.claimantBrandId);
  const seller = presentUserByIdOrFail(claim.accusedSellerUserId);
  return {
    id: claim.id,
    type: claim.type,
    status: claim.status,
    claimantBrand: { id: claim.claimantBrandId, name: brand?.name ?? "Unknown brand", logoUrl: brand?.logoPhotoId ? buildUnsplashImageUrl(brand.logoPhotoId, 80) : null, officialStatus: brand?.officialStatus ?? "NONE" },
    accusedSeller: seller,
    listing: { id: claim.listing.id, title: claim.listing.title, price: { amountMinor: claim.listing.amountMinor, currency: seller.currency }, imageUrl: buildUnsplashImageUrl(claim.listing.photoId, 480), listingUrl: `https://nantty.com/p/${claim.listing.id}`, storeName: claim.listing.storeName, status: claim.listing.status },
    filedAt: claim.filedAt,
    slaDueAt: claim.slaDueAt,
    priorStrikeCount: seller.strikeCount,
  };
}

export function presentIpClaimDetail(claim: MockIpClaimRecord): IpClaimDetail {
  const strikes = readUserExtrasForPeople(claim.accusedSellerUserId).strikes;
  return {
    ...presentIpClaimSummary(claim),
    statement: claim.statement,
    trademarkReference: claim.trademarkReference,
    evidence: claim.evidence,
    sellerResponse: claim.sellerResponse,
    sellerPriorStrikes: strikes.map((strike) => ({ policy: strike.policy, issuedAt: strike.issuedAt })),
    decision: claim.decision,
    allowedActions: readAllowedIpClaimActions(claim),
    history: listMockAuditEntriesForTarget("ipClaim", claim.id),
  };
}

export function presentBrandDetail(brand: MockBrandRecord): BrandDetail {
  return {
    ...presentBrandSummary(brand),
    description: brand.description,
    members: brand.members.flatMap((member) => {
      const user = presentUserById(member.userId);
      return user ? [{ user, role: member.role, addedAt: member.addedAt }] : [];
    }),
    linkedStores: brand.linkedStores.flatMap((store) => {
      const seller = presentUserById(store.sellerUserId);
      return seller ? [{ id: store.id, storeName: store.storeName, seller, linkedAt: store.linkedAt, isVerified: store.isVerified, hasOfficialBadge: store.hasOfficialBadge }] : [];
    }),
    officialRequest: brand.officialRequest ? presentOfficialRequest(brand, brand.officialRequest) : null,
    allowedOfficialActions: readAllowedOfficialActions(brand),
    claimsFiled: readBrandsMockStore().claims.filter((claim) => claim.claimantBrandId === brand.id).map(presentIpClaimSummary),
    history: listMockAuditEntriesForTarget("brand", brand.id),
  };
}
