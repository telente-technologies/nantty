import type { AffiliateEarningsPage, AffiliateEarningStatus, AffiliateLink, AffiliatePromotion, PromotableProduct } from "@/types/affiliate.type";
import type { CreatorAffiliation } from "@/types/creator.type";

import { api } from "../core/apiClient.service";

export const affiliatesService = {
  listPromotableProducts: (search: string, cursor: string | null) =>
    api.getPage<PromotableProduct>("/api/v1/creators/me/affiliate-catalog", { q: search || undefined, sort: "commission", cursor: cursor ?? undefined, limit: 24 }),
  listPromotions: () => api.getList<AffiliatePromotion>("/api/v1/creators/me/affiliate-promotions"),
  listEarnings: (status: AffiliateEarningStatus, cursor: string | null) =>
    api.get<AffiliateEarningsPage>("/api/v1/creators/me/affiliate-earnings", { status, cursor: cursor ?? undefined, limit: 20 }),
  createLink: (productId: string) => api.post<AffiliateLink>("/api/v1/creators/me/affiliate-links", { productId }),
  requestToPromote: (productId: string) => api.post<CreatorAffiliation>("/api/v1/creators/affiliations", { productId }),
};
