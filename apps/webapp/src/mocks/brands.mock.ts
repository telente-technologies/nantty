import { ApiError } from "@/errors/api.error";
import { resolveMockCreatorStatusForSignedInUser } from "./creators.mock";
import type { ActingProfile, BrandProducts, NewBrandInput } from "@/types/brand.type";

import { BRAND_ID_BY_PRODUCT_KEY, findBrandRecord, isVerifiedOfficialStoreOfBrand, mockBrandRecords, presentBrandDetail, presentBrandSummary } from "./brandDirectory.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { buildCatalogProductSummary, catalogProductSeeds } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findDirectoryStoreById } from "./storeDirectory.mock";
import { checkAvailability } from "./username.mock";

export const followedBrandIds = new Set<string>(["br_adire"]);
const actingProfileIdByUserId = new Map<string, string>();

const findBrandOrThrow = (brandId: string) => {
  const brand = findBrandRecord(brandId);
  if (!brand) throw new ApiError(404, "Brand not found");
  return brand;
};

function listProfilesOfSignedInUser(): ActingProfile[] {
  const user = getSignedInMockUser();
  const person: ActingProfile = { kind: "person", id: user.id, name: user.name, handle: user.username, avatarUrl: user.avatarUrl, verification: user.verification ?? null, creatorStatus: resolveMockCreatorStatusForSignedInUser().status };
  const store = user.storeId ? findDirectoryStoreById(user.storeId) : null;
  const storeProfile: ActingProfile[] = store
    ? [{ kind: "store", id: store.id, name: store.name, handle: store.handle, avatarUrl: user.avatarUrl, verification: user.verification ?? null }]
    : [];
  const brandProfiles: ActingProfile[] = mockBrandRecords
    .filter((brand) => brand.ownerUserKey === user.id)
    .map((brand) => ({ kind: "brand", id: brand.id, name: brand.name, handle: brand.handle, avatarUrl: brand.logoUrl, verification: brand.verification }));
  return [person, ...storeProfile, ...brandProfiles];
}

export function findOwnedProfileOfSignedInUser(profileId: string): ActingProfile | undefined {
  return listProfilesOfSignedInUser().find((profile) => profile.id === profileId);
}

export const brandsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/brands", ({ query }) => {
    const term = (query.get("q") ?? "").trim().toLowerCase();
    return mockBrandRecords
      .filter((brand) => !term || brand.name.toLowerCase().includes(term) || brand.handle.includes(term))
      .map((brand) => presentBrandSummary(brand, followedBrandIds));
  }),
  createMockRoute("POST", "/api/v1/brands", ({ body }) => {
    const input = body as NewBrandInput;
    const handle = input.handle.trim().toLowerCase();
    if (input.name.trim().length < 2) throw new ApiError(422, "Add your brand name");
    const availability = checkAvailability(handle);
    if (!availability.available || mockBrandRecords.some((brand) => brand.handle === handle)) throw new ApiError(409, "That handle isn't available");
    const brand = {
      id: `br_${Date.now()}`, name: input.name.trim(), handle, ownerUserKey: getSignedInMockUser().id as "u_me", officialStoreId: null, categoryId: input.categoryId,
      description: input.description.trim(), website: input.website, verification: null, followers: 0, logoUrl: input.logoUrl, coverUrl: input.coverUrl,
    };
    mockBrandRecords.push(brand);
    return presentBrandDetail(brand, followedBrandIds);
  }),
  createMockRoute("GET", "/api/v1/brands/:brandId", ({ params }) => presentBrandDetail(findBrandOrThrow(params.brandId!), followedBrandIds)),
  createMockRoute("GET", "/api/v1/brands/:brandId/products", ({ params }): BrandProducts => {
    const brand = findBrandOrThrow(params.brandId!);
    const tagged = catalogProductSeeds.filter((seed) => BRAND_ID_BY_PRODUCT_KEY[seed.key] === brand.id);
    return {
      officialStoreProducts: tagged.filter((seed) => isVerifiedOfficialStoreOfBrand(brand, seed.storeId)).map((seed) => buildCatalogProductSummary(seed)),
      otherSellersProducts: tagged.filter((seed) => !isVerifiedOfficialStoreOfBrand(brand, seed.storeId)).map((seed) => buildCatalogProductSummary(seed)),
    };
  }),
  createMockRoute("POST", "/api/v1/brands/:brandId/follow", ({ params }) => void followedBrandIds.add(findBrandOrThrow(params.brandId!).id)),
  createMockRoute("DELETE", "/api/v1/brands/:brandId/follow", ({ params }) => void followedBrandIds.delete(params.brandId!)),
  createMockRoute("GET", "/api/v1/users/me/profiles", () => listProfilesOfSignedInUser()),
  createMockRoute("GET", "/api/v1/users/me/acting-profile", () => {
    const profiles = listProfilesOfSignedInUser();
    return profiles.find((profile) => profile.id === actingProfileIdByUserId.get(getSignedInMockUser().id)) ?? profiles[0];
  }),
  createMockRoute("PUT", "/api/v1/users/me/acting-profile", ({ body }) => {
    const { profileId } = body as { profileId: string };
    const profile = findOwnedProfileOfSignedInUser(profileId);
    if (!profile) throw new ApiError(403, "You can't act as that profile");
    actingProfileIdByUserId.set(getSignedInMockUser().id, profile.id);
    return profile;
  }),
];
