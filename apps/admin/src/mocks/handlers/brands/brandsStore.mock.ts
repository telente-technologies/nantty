import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { failNotFound } from "@/mocks/mockResponses.mock";
import { buildDemoBrands, type MockBrandRecord } from "@/mocks/seed/brandsDirectory.mock";
import { buildDemoIpClaims, type MockIpClaimRecord } from "@/mocks/seed/brandsIpClaims.mock";

export interface BrandsMockStore {
  readonly brands: MockBrandRecord[];
  readonly claims: MockIpClaimRecord[];
}

export function readBrandsMockStore(): BrandsMockStore {
  return readMockAreaStore("brands", () => ({ brands: buildDemoBrands(), claims: buildDemoIpClaims() }));
}

export function findBrandRecordOrFail(brandId: string | undefined): MockBrandRecord {
  const brand = readBrandsMockStore().brands.find((candidate) => candidate.id === brandId);
  if (!brand) failNotFound("Brand");
  return brand;
}

export function findIpClaimRecordOrFail(claimId: string | undefined): MockIpClaimRecord {
  const claim = readBrandsMockStore().claims.find((candidate) => candidate.id === claimId);
  if (!claim) failNotFound("Claim");
  return claim;
}
