import { findManagedBrandOrThrow, isBrandOfficiallyActive, readBrandsMockState, recordBrandAuditEntry, requireBrandRole } from "@/mocks/brandsMockStore.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier, matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockBrandListing, MockBrandRecord } from "@/mocks/seed/demoBrands.mock";
import type { BrandClaim, BrandClaimKind, BrandListingReport } from "@/types/brand.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

const brandClaimKinds: BrandClaimKind[] = ["counterfeit", "trademark", "unauthorised_seller"];
const maximumListingsPerClaim = 20;

function readOfficialBrandForRequest(request: MockRequest): { brand: MockBrandRecord; principal: ReturnType<typeof requireMockStorePrincipal>; member: MockBrandRecord["members"][number] } {
  const principal = requireMockStorePrincipal(request);
  const { brand, member } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
  if (!isBrandOfficiallyActive(brand)) throw new MockHttpError(403, "BRAND_PROTECTION_REQUIRES_OFFICIAL", "Brand protection is available to registered brands with an active Official Store.");
  return { brand, principal, member };
}

function convertListingToReport(listing: MockBrandListing): BrandListingReport {
  const currency = readMockDatabase().settings.currency;
  const matchedProduct = readMockDatabase().products.find((product) => product.id === listing.matchedProductId);
  const recommendedMinor = matchedProduct ? Math.min(...matchedProduct.variants.map((variant) => variant.price.amountMinor)) : null;
  const differenceBasisPoints = recommendedMinor ? Math.round(((listing.priceMinor - recommendedMinor) * 10_000) / recommendedMinor) : null;
  const riskReasons: string[] = [];
  if (listing.relationshipClaimed === "own") riskReasons.push("Claims to be your own brand but is not one of your stores");
  if (differenceBasisPoints !== null && differenceBasisPoints <= -5_000) riskReasons.push("Priced at less than half your price");
  else if (differenceBasisPoints !== null && differenceBasisPoints <= -2_000) riskReasons.push("Priced well below your price");
  if (listing.sellerAccountAgeDays < 30) riskReasons.push("Seller account is less than 30 days old");
  const risk = riskReasons.length >= 2 || listing.relationshipClaimed === "own" ? "high" : riskReasons.length === 1 ? "medium" : "low";
  return {
    id: listing.id,
    sellerName: listing.sellerName,
    sellerHandle: listing.sellerHandle,
    title: listing.title,
    imageUrl: listing.imageUrl,
    price: { amountMinor: listing.priceMinor, currency },
    yourRecommendedPrice: recommendedMinor === null ? null : { amountMinor: recommendedMinor, currency },
    priceDifferenceBasisPoints: differenceBasisPoints,
    relationshipClaimed: listing.relationshipClaimed,
    risk,
    riskReasons,
    listedAt: listing.listedAt,
    openClaimId: listing.openClaimId,
  };
}

function validateClaimBody(body: Record<string, unknown>, brandListings: readonly MockBrandListing[]): { issues: ValidationIssue[]; listingIds: string[] } {
  const issues: ValidationIssue[] = [];
  if (!brandClaimKinds.includes(body.kind as BrandClaimKind)) issues.push({ path: "kind", message: "Choose counterfeit, trademark misuse or unauthorised seller." });
  const listingIds = Array.isArray(body.listingIds) ? [...new Set(body.listingIds.filter((value): value is string => typeof value === "string"))] : [];
  if (listingIds.length < 1 || listingIds.length > maximumListingsPerClaim) issues.push({ path: "listingIds", message: `Select between 1 and ${maximumListingsPerClaim} listings.` });
  else if (listingIds.some((listingId) => !brandListings.some((listing) => listing.id === listingId))) issues.push({ path: "listingIds", message: "One of the selected listings is no longer available." });
  else if (listingIds.some((listingId) => brandListings.find((listing) => listing.id === listingId)?.openClaimId)) issues.push({ path: "listingIds", message: "One of the selected listings already has an open claim." });
  const evidence = typeof body.evidence === "string" ? body.evidence.trim() : "";
  if (evidence.length < 30 || evidence.length > 2_000) issues.push({ path: "evidence", message: "Describe your evidence in 30 to 2,000 characters." });
  if (body.declaration !== true) issues.push({ path: "declaration", message: "Confirm that the claim is true and that you own or represent the brand." });
  return { issues, listingIds };
}

export function registerBrandProtectionMockRoutes(): void {
  registerMockRoute("GET", "/seller/brands/:brandId/protection/listings", (request) => {
    const { brand } = readOfficialBrandForRequest(request);
    const riskFilter = request.query.get("risk");
    const reports = readBrandsMockState().listings
      .filter((listing) => listing.brandId === brand.id)
      .filter((listing) => matchesSearchText(request.query.get("q"), listing.title, listing.sellerName, listing.sellerHandle))
      .map(convertListingToReport)
      .filter((report) => !riskFilter || report.risk === riskFilter)
      .sort((first, second) => ["high", "medium", "low"].indexOf(first.risk) - ["high", "medium", "low"].indexOf(second.risk));
    return respondWithJson(200, paginateMockList(reports, request.query, 25));
  });

  registerMockRoute("GET", "/seller/brands/:brandId/protection/claims", (request) => {
    const { brand } = readOfficialBrandForRequest(request);
    const claims = readBrandsMockState().claims.filter((claim) => claim.brandId === brand.id).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    return respondWithJson(200, paginateMockList(claims, request.query, 25));
  });

  registerMockRoute("POST", "/seller/brands/:brandId/protection/claims", (request) => {
    const { brand, principal, member } = readOfficialBrandForRequest(request);
    requireBrandRole(member, ["owner", "admin"], "file brand claims");
    const state = readBrandsMockState();
    const brandListings = state.listings.filter((listing) => listing.brandId === brand.id);
    const body = readJsonObjectBody(request);
    const { issues, listingIds } = validateClaimBody(body, brandListings);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const now = new Date().toISOString();
    const claim: BrandClaim = {
      id: createMockIdentifier("bclm"),
      brandId: brand.id,
      kind: body.kind as BrandClaimKind,
      listings: listingIds.map((listingId) => {
        const listing = brandListings.find((candidate) => candidate.id === listingId);
        return { listingId, title: listing?.title ?? "", sellerHandle: listing?.sellerHandle ?? "" };
      }),
      evidence: String(body.evidence).trim(),
      status: "submitted",
      createdAt: now,
      updatedAt: now,
      resolution: null,
    };
    state.claims.unshift(claim);
    for (const listing of brandListings) if (listingIds.includes(listing.id)) listing.openClaimId = claim.id;
    recordBrandAuditEntry(principal, "brand.claim_filed", brand.id, `Filed a ${claim.kind.replace("_", " ")} claim against ${listingIds.length} listing(s)`);
    return respondWithJson(201, claim);
  });

  registerMockRoute("POST", "/seller/brands/:brandId/protection/claims/:claimId/withdraw", (request) => {
    const { brand, principal, member } = readOfficialBrandForRequest(request);
    requireBrandRole(member, ["owner", "admin"], "withdraw brand claims");
    const state = readBrandsMockState();
    const claimIndex = state.claims.findIndex((claim) => claim.id === request.params.claimId && claim.brandId === brand.id);
    const claim = state.claims[claimIndex];
    if (!claim) throw new MockHttpError(404, "CLAIM_NOT_FOUND", "That claim does not exist.");
    if (claim.status !== "submitted" && claim.status !== "under_review") throw new MockHttpError(409, "CLAIM_CLOSED", "This claim has already been decided.");
    const withdrawnClaim: BrandClaim = { ...claim, status: "withdrawn", updatedAt: new Date().toISOString(), resolution: "Withdrawn by the brand." };
    state.claims[claimIndex] = withdrawnClaim;
    for (const listing of state.listings) if (listing.openClaimId === claim.id) listing.openClaimId = null;
    recordBrandAuditEntry(principal, "brand.claim_withdrawn", brand.id, `Withdrew claim ${claim.id}`);
    return respondWithJson(200, withdrawnClaim);
  });
}
