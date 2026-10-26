import { appendMockAuditLogEntry, readGlobalMockSlice, readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { MockPrincipal } from "@/mocks/mockRouter.mock";
import { convertSubscriptionPlanToGoldBadgeTier } from "@/mocks/mockStoreMembership.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import { seedDemoBrandsMockState, type BrandsMockState, type MockBrandRecord } from "@/mocks/seed/demoBrands.mock";
import type { Brand, BrandMember, BrandSummary, OfficialStoreDetails, OfficialStoreRequirement, ProductBrandRelationship, ProductBrandTag } from "@/types/brand.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

const productBrandRelationships: ProductBrandRelationship[] = ["own", "authorised_reseller", "genuine_resale"];

export function readBrandsMockState(): BrandsMockState {
  return readGlobalMockSlice("brands", seedDemoBrandsMockState);
}

export function findBrandMembershipForUser(brand: MockBrandRecord, userId: string): BrandMember | undefined {
  return brand.members.find((member) => member.userId === userId && member.status === "active");
}

export function findManagedBrandOrThrow(brandId: string, userId: string): { brand: MockBrandRecord; member: BrandMember } {
  const brand = readBrandsMockState().brands.find((candidate) => candidate.id === brandId);
  const member = brand ? findBrandMembershipForUser(brand, userId) : undefined;
  if (!brand || !member) throw new MockHttpError(404, "BRAND_NOT_FOUND", "That brand does not exist or you are not on its team.");
  return { brand, member };
}

export function requireBrandRole(member: BrandMember, allowedRoles: readonly BrandMember["role"][], action: string): void {
  if (!allowedRoles.includes(member.role)) throw new MockHttpError(403, "BRAND_ROLE_FORBIDDEN", `Your brand role (${member.role}) cannot ${action}. Ask the brand owner or an admin.`);
}

function readGateStore(storeId: string | null) {
  return storeId ? readMockDatabase().gateStores.find((store) => store.storeId === storeId) : undefined;
}

function isGateStoreGoldActive(storeId: string | null): boolean {
  const status = readGateStore(storeId)?.subscription.subscription?.status;
  return status === "active" || status === "trialing";
}

export function buildOfficialStoreDetails(brand: MockBrandRecord): OfficialStoreDetails {
  const candidateStoreId = brand.officialStore.storeId ?? brand.storeIds[0] ?? null;
  const candidateStore = readGateStore(candidateStoreId);
  const hasOpenTrademarkClaimAgainstBrand = false;
  const requirements: OfficialStoreRequirement[] = [
    { key: "brand_registered", label: "Brand registered with Nantty", met: brand.registration.status === "registered", howToFix: "In the Nantty app, open your brand, choose Register brand and upload your trademark certificate or CAC business name registration." },
    { key: "store_linked", label: "A store is linked to the brand", met: brand.storeIds.length > 0, howToFix: "Link the store that sells your brand on the Stores tab." },
    { key: "store_gold_verified", label: "That store is Gold verified", met: candidateStore?.verificationStatus === "verified", howToFix: "Finish business verification for the store in the Nantty app." },
    { key: "gold_plan_active", label: "Gold Pro or Gold Premium is active", met: isGateStoreGoldActive(candidateStoreId), howToFix: "Keep a Gold plan active on the store (Settings → Billing & Gold plan)." },
    { key: "no_open_trademark_disputes", label: "No open trademark disputes against the brand", met: !hasOpenTrademarkClaimAgainstBrand, howToFix: "Resolve any trademark dispute with the Nantty brand team first." },
  ];
  const everyRequirementMet = requirements.every((requirement) => requirement.met);
  if (brand.officialStore.status === "active") {
    return { officialStore: everyRequirementMet ? brand.officialStore : { ...brand.officialStore, status: "suspended", reason: "A requirement is no longer met, so the Official Store badge is paused." }, requirements, candidateStoreId };
  }
  return { officialStore: { status: everyRequirementMet ? "eligible" : "not_eligible", storeId: null, reason: brand.officialStore.reason }, requirements, candidateStoreId };
}

export function presentBrand(brand: MockBrandRecord): Brand {
  const owningStore = readGateStore(brand.officialStore.storeId ?? brand.storeIds[0] ?? null);
  const subscription = owningStore?.subscription.subscription ?? null;
  const isGold = owningStore?.verificationStatus === "verified" && isGateStoreGoldActive(owningStore.storeId);
  return {
    id: brand.id,
    name: brand.name,
    handle: brand.handle,
    logoUrl: brand.logoUrl,
    coverUrl: brand.coverUrl,
    description: brand.description,
    website: brand.website,
    sellingEnabled: brand.sellingEnabled ?? brand.storeIds.length > 0,
    country: brand.country,
    registration: brand.registration,
    verification: { status: owningStore?.verificationStatus ?? "unverified", tier: isGold ? convertSubscriptionPlanToGoldBadgeTier(subscription?.plan) : null, badgeVisible: isGold },
    officialStore: buildOfficialStoreDetails(brand).officialStore,
    members: brand.members,
    storeIds: brand.storeIds,
  };
}

export function presentBrandSummary(brand: MockBrandRecord, userId: string): BrandSummary {
  return {
    id: brand.id,
    name: brand.name,
    handle: brand.handle,
    logoUrl: brand.logoUrl,
    registrationStatus: brand.registration.status,
    officialStoreStatus: buildOfficialStoreDetails(brand).officialStore.status,
    myRole: findBrandMembershipForUser(brand, userId)?.role ?? "viewer",
    storeCount: brand.storeIds.length,
  };
}

export function isBrandOfficiallyActive(brand: MockBrandRecord): boolean {
  return buildOfficialStoreDetails(brand).officialStore.status === "active";
}

export function resolveProductBrandTagForStore(storeId: string, requestedTag: unknown): { tag: ProductBrandTag | null | undefined; issues: ValidationIssue[] } {
  if (requestedTag === undefined) return { tag: undefined, issues: [] };
  if (requestedTag === null) return { tag: null, issues: [] };
  const record = typeof requestedTag === "object" ? (requestedTag as Record<string, unknown>) : {};
  const brand = readBrandsMockState().brands.find((candidate) => candidate.id === record.brandId);
  const relationship = record.relationship as ProductBrandRelationship;
  if (!brand) return { tag: null, issues: [{ path: "brand.brandId", message: "Choose a brand from the brand directory." }] };
  if (!productBrandRelationships.includes(relationship)) return { tag: null, issues: [{ path: "brand.relationship", message: "Choose how you sell this brand." }] };
  const storeBelongsToBrand = brand.storeIds.includes(storeId);
  if (relationship === "own" && !storeBelongsToBrand) return { tag: null, issues: [{ path: "brand.relationship", message: `Only stores linked to ${brand.name} can list it as their own brand. Choose authorised reseller or genuine resale.` }] };
  if (relationship !== "own" && brand.registration.status !== "registered") return { tag: null, issues: [{ path: "brand.brandId", message: `${brand.name} is not a registered brand yet, so it can't be tagged for resale.` }] };
  return { tag: { brandId: brand.id, name: brand.name, relationship }, issues: [] };
}

export function recordBrandAuditEntry(principal: MockPrincipal, action: string, targetId: string, summary: string): void {
  appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" }, action, targetType: "brand", targetId, summary });
}
