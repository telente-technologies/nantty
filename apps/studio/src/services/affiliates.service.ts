import type { Page } from "@/types";
import type { AffiliateCatalogQuery, AffiliateEarningsPage, AffiliateEarningStatus, AffiliateLink, AffiliatePromotion, AffiliationRequestResult, PromotableProduct } from "@/types/affiliate.type";

import { createIdempotencyKey, sendRequestToStudioServer } from "./clientApi.service";

export const affiliatesService = {
  listPromotableProducts: (query: AffiliateCatalogQuery) =>
    sendRequestToStudioServer<Page<PromotableProduct>>("/api/v1/creators/me/affiliate-catalog", {
      query: { q: query.search || undefined, sort: query.sort, access: query.access === "all" ? undefined : query.access, cursor: query.cursor, limit: 24 },
    }),
  listPromotions: () => sendRequestToStudioServer<Page<AffiliatePromotion>>("/api/v1/creators/me/affiliate-promotions"),
  listEarnings: (status: AffiliateEarningStatus, cursor?: string) =>
    sendRequestToStudioServer<AffiliateEarningsPage>("/api/v1/creators/me/affiliate-earnings", { query: { status, cursor, limit: 20 } }),
  createLink: (productId: string) =>
    sendRequestToStudioServer<AffiliateLink>("/api/v1/creators/me/affiliate-links", { method: "POST", body: { productId }, idempotencyKey: createIdempotencyKey("aff-link") }),
  requestToPromote: (productId: string) =>
    sendRequestToStudioServer<AffiliationRequestResult>("/api/v1/creators/affiliations", { method: "POST", body: { productId }, idempotencyKey: createIdempotencyKey("aff-request") }),
};
