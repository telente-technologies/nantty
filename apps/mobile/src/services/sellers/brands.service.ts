import type { Page } from "@/types";
import type { BusinessCategory, BusinessProfileInput } from "@/types/socialGraph.type";
import type { ActingProfile, BrandDetail, BrandProducts, BrandSummary, LinkedProfiles, NewBrandInput } from "@/types/brand.type";

import { api } from "../core/apiClient.service";

export const brandsService = {
  searchBrands: (query: string) => api.getList<BrandSummary>("/api/v1/brands", { q: query }),
  fetchBrandById: (brandId: string) => api.get<BrandDetail>(`/api/v1/brands/${encodeURIComponent(brandId)}`),
  fetchBrandProducts: (brandId: string) => api.get<BrandProducts>(`/api/v1/brands/${encodeURIComponent(brandId)}/products`),
  followBrand: (brandId: string) => api.post<void>(`/api/v1/brands/${encodeURIComponent(brandId)}/follow`),
  unfollowBrand: (brandId: string) => api.delete<void>(`/api/v1/brands/${encodeURIComponent(brandId)}/follow`),
  createBrand: (input: NewBrandInput, idempotencyKey: string) => api.post<BrandDetail>("/api/v1/brands", input, { idempotencyKey }),
  listBusinessCategories: () => api.get<Page<BusinessCategory>>("/api/v1/business-categories"),
  createBusinessProfile: (input: BusinessProfileInput, idempotencyKey: string) =>
    api.post<ActingProfile>("/api/v1/users/me/business-profiles", input, { idempotencyKey }),
  listMyProfiles: () => api.getList<ActingProfile>("/api/v1/users/me/profiles"),
  fetchMyActingProfile: () => api.get<ActingProfile>("/api/v1/users/me/acting-profile"),
  switchActingProfile: (profileId: string) => api.put<ActingProfile>("/api/v1/users/me/acting-profile", { profileId }),
  fetchLinkedProfiles: () => api.get<LinkedProfiles>("/api/v1/users/me/linked-profiles"),
  chooseLinkedProfiles: (keep: readonly string[], stepUpToken: string) =>
    api.post<LinkedProfiles>("/api/v1/users/me/linked-profiles/choose", { keep }, { headers: { "X-Step-Up-Token": stepUpToken } }),
  setBrandSelling: (brandId: string, sellingEnabled: boolean, stepUpToken: string) =>
    api.patch<BrandDetail>(`/api/v1/brands/${encodeURIComponent(brandId)}`, { sellingEnabled }, { headers: { "X-Step-Up-Token": stepUpToken } }),
};
