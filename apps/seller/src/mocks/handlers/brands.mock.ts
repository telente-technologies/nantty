import { buildOfficialStoreDetails, findManagedBrandOrThrow, presentBrand, presentBrandSummary, readBrandsMockState, recordBrandAuditEntry, requireBrandRole } from "@/mocks/brandsMockStore.mock";
import { registerBrandMembersMockRoutes } from "@/mocks/handlers/brandMembers.mock";
import { registerBrandProtectionMockRoutes } from "@/mocks/handlers/brandProtection.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, matchesSearchText, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { convertSubscriptionPlanToGoldBadgeTier } from "@/mocks/mockStoreMembership.mock";
import { registerMockRoute, type MockPrincipal } from "@/mocks/mockRouter.mock";
import type { BrandDirectoryEntry, MyStoreEntry } from "@/types/brand.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

const websitePattern = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i;
const imageUrlPattern = /^(https:\/\/images\.unsplash\.com\/|data:image\/(png|jpeg|webp|avif);base64,|\/photos\/)/;

function validateBrandProfilePatch(body: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allowedKeys = new Set(["name", "description", "website", "logoUrl", "coverUrl", "logoMediaId", "coverMediaId"]);
  for (const key of Object.keys(body)) if (!allowedKeys.has(key)) issues.push({ path: key, message: `${key} cannot be changed here.` });
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 60)) issues.push({ path: "name", message: "Brand name needs 2 to 60 characters." });
  if (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 1000)) issues.push({ path: "description", message: "Description must be 1,000 characters or fewer." });
  if (body.website !== undefined && body.website !== null && body.website !== "" && (typeof body.website !== "string" || !websitePattern.test(body.website) || body.website.length > 200)) issues.push({ path: "website", message: "Website must start with https:// and be a valid address." });
  for (const key of ["logoUrl", "coverUrl"] as const) {
    const value = body[key];
    if (value !== undefined && value !== null && (typeof value !== "string" || !imageUrlPattern.test(value) || value.length > 3_000_000)) issues.push({ path: key, message: "Upload the image with the photo picker." });
  }
  return issues;
}

function resolveMediaUrlIfGiven(mediaId: unknown): string | undefined {
  if (typeof mediaId !== "string") return undefined;
  const media = readMockDatabase().media.get(mediaId);
  if (!media || media.status !== "ready") throw new MockHttpError(422, "MEDIA_NOT_READY", "That image has not finished uploading.");
  return media.url;
}

function listMyStores(principal: MockPrincipal): MyStoreEntry[] {
  const database = readMockDatabase();
  const brands = readBrandsMockState().brands;
  return database.memberships.filter((membership) => membership.userId === principal.userId).flatMap((membership) => {
    const gateStore = database.gateStores.find((store) => store.storeId === membership.storeId);
    if (!gateStore) return [];
    const subscription = gateStore.subscription.subscription;
    const isGold = gateStore.verificationStatus === "verified" && (subscription?.status === "active" || subscription?.status === "trialing");
    return [{
      storeId: gateStore.storeId,
      storeName: gateStore.storeName,
      brandId: brands.find((brand) => brand.storeIds.includes(gateStore.storeId))?.id ?? null,
      role: membership.role,
      verification: { status: gateStore.verificationStatus, tier: isGold ? convertSubscriptionPlanToGoldBadgeTier(subscription?.plan) : null, badgeVisible: isGold },
      subscription: subscription ? { status: subscription.status, plan: subscription.plan } : null,
      isCurrent: gateStore.storeId === principal.storeId,
    }];
  });
}

export function registerBrandsMockHandlers(): void {
  registerMockRoute("GET", "/seller/stores/mine", (request) => {
    const principal = request.principal;
    if (!principal) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    return respondWithJson(200, { data: listMyStores(principal), nextCursor: null });
  });

  registerMockRoute("GET", "/seller/brands", (request) => {
    const principal = requireMockStorePrincipal(request);
    const brands = readBrandsMockState().brands.filter((brand) => brand.members.some((member) => member.userId === principal.userId && member.status === "active"));
    return respondWithJson(200, { data: brands.map((brand) => presentBrandSummary(brand, principal.userId)), nextCursor: null });
  });

  registerMockRoute("GET", "/seller/brands/directory", (request) => {
    const principal = requireMockStorePrincipal(request);
    const searchText = request.query.get("q");
    const entries: BrandDirectoryEntry[] = readBrandsMockState().brands
      .filter((brand) => brand.registration.status === "registered" || brand.storeIds.includes(principal.storeId))
      .filter((brand) => matchesSearchText(searchText, brand.name, brand.handle))
      .map((brand) => ({ id: brand.id, name: brand.name, handle: brand.handle, logoUrl: brand.logoUrl, isOfficial: buildOfficialStoreDetails(brand).officialStore.status === "active", isMine: brand.storeIds.includes(principal.storeId) }))
      .sort((first, second) => Number(second.isMine) - Number(first.isMine) || first.name.localeCompare(second.name));
    return respondWithJson(200, { data: entries.slice(0, 50), nextCursor: null });
  });

  registerMockRoute("GET", "/seller/brands/:brandId", (request) => {
    const principal = requireMockStorePrincipal(request);
    return respondWithJson(200, presentBrand(findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId).brand));
  });

  registerMockRoute("PATCH", "/seller/brands/:brandId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { brand, member } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
    requireBrandRole(member, ["owner", "admin", "editor"], "edit the brand profile");
    const body = readJsonObjectBody(request);
    const issues = validateBrandProfilePatch(body);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    if (typeof body.name === "string" && body.name.trim() !== brand.name && brand.registration.status === "registered") {
      throw new MockHttpError(409, "REGISTERED_NAME_LOCKED", "A registered brand's name matches its trademark. Change it through brand registration in the Zudomart app.");
    }
    if (typeof body.name === "string") brand.name = body.name.trim();
    if (typeof body.description === "string") brand.description = body.description.trim();
    if (body.website !== undefined) brand.website = typeof body.website === "string" && body.website ? body.website : null;
    const logoFromMedia = resolveMediaUrlIfGiven(body.logoMediaId);
    const coverFromMedia = resolveMediaUrlIfGiven(body.coverMediaId);
    if (logoFromMedia !== undefined || body.logoUrl !== undefined) brand.logoUrl = logoFromMedia ?? (body.logoUrl as string | null);
    if (coverFromMedia !== undefined || body.coverUrl !== undefined) brand.coverUrl = coverFromMedia ?? (body.coverUrl as string | null);
    recordBrandAuditEntry(principal, "brand.updated", brand.id, `Updated the ${brand.name} brand profile`);
    return respondWithJson(200, presentBrand(brand));
  });

  registerMockRoute("PATCH", "/brands/:brandId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { brand, member } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
    if (member.role !== "owner") throw new MockHttpError(403, "OWNER_ONLY", "Only the brand owner can do that.");
    if (!request.headers.get("x-step-up-token")) throw new MockHttpError(403, "STEP_UP_REQUIRED", "Confirm it's you again to continue.");
    const body = readJsonObjectBody(request);
    if (typeof body.sellingEnabled !== "boolean") return respondWithValidationFailure([{ path: "sellingEnabled", message: "is required" }]);
    brand.sellingEnabled = body.sellingEnabled;
    recordBrandAuditEntry(principal, "brand.updated", brand.id, `${body.sellingEnabled ? "Turned on" : "Turned off"} selling for ${brand.name}`);
    return respondWithJson(200, presentBrand(brand));
  });

  registerMockRoute("POST", "/seller/brands/:brandId/stores", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { brand, member } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
    requireBrandRole(member, ["owner", "admin"], "link stores");
    const storeId = String(readJsonObjectBody(request).storeId ?? "");
    const myStore = listMyStores(principal).find((store) => store.storeId === storeId);
    if (!myStore || (myStore.role !== "owner" && myStore.role !== "manager")) throw new MockHttpError(403, "STORE_NOT_MANAGED", "You can only link stores where you are the owner or a manager.");
    if (myStore.brandId && myStore.brandId !== brand.id) throw new MockHttpError(409, "STORE_HAS_BRAND", `${myStore.storeName} already belongs to another brand. Unlink it there first.`);
    if (!brand.storeIds.includes(storeId)) brand.storeIds.push(storeId);
    recordBrandAuditEntry(principal, "brand.store_linked", brand.id, `Linked ${myStore.storeName} to ${brand.name}`);
    return respondWithJson(200, presentBrand(brand));
  });

  registerMockRoute("DELETE", "/seller/brands/:brandId/stores/:storeId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { brand, member } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
    requireBrandRole(member, ["owner", "admin"], "unlink stores");
    const storeId = request.params.storeId ?? "";
    if (!brand.storeIds.includes(storeId)) throw new MockHttpError(404, "STORE_NOT_LINKED", "That store is not linked to this brand.");
    if (brand.officialStore.status === "active" && brand.officialStore.storeId === storeId) throw new MockHttpError(409, "OFFICIAL_STORE_LINKED", "This is your Official Store. Contact Zudomart to move the Official Store badge before unlinking it.");
    brand.storeIds = brand.storeIds.filter((candidate) => candidate !== storeId);
    recordBrandAuditEntry(principal, "brand.store_unlinked", brand.id, `Unlinked a store from ${brand.name}`);
    return respondWithNoContent();
  });

  registerMockRoute("GET", "/seller/brands/:brandId/official-store", (request) => {
    const principal = requireMockStorePrincipal(request);
    return respondWithJson(200, buildOfficialStoreDetails(findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId).brand));
  });

  registerMockRoute("POST", "/seller/brands/:brandId/official-store/apply", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { brand, member } = findManagedBrandOrThrow(request.params.brandId ?? "", principal.userId);
    requireBrandRole(member, ["owner"], "apply for an Official Store");
    const details = buildOfficialStoreDetails(brand);
    if (details.officialStore.status === "active") throw new MockHttpError(409, "ALREADY_OFFICIAL", `${brand.name} already has an Official Store.`);
    const unmet = details.requirements.filter((requirement) => !requirement.met);
    if (unmet.length > 0) throw new MockHttpError(422, "OFFICIAL_STORE_REQUIREMENTS_UNMET", `Finish these first: ${unmet.map((requirement) => requirement.label.toLowerCase()).join("; ")}.`);
    brand.officialStore = { status: "active", storeId: details.candidateStoreId, reason: null };
    recordBrandAuditEntry(principal, "brand.official_store_activated", brand.id, `${brand.name} became an Official Store`);
    return respondWithJson(200, buildOfficialStoreDetails(brand));
  });

  registerBrandMembersMockRoutes();
  registerBrandProtectionMockRoutes();
}
