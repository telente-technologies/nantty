import { ApiError } from "@/errors/api.error";
import type { Money } from "@/types";
import type { AffiliateEarning, AffiliateLink, AffiliateProgrammeTerms, AffiliatePromotion, PromotableProduct } from "@/types/affiliate.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const ngn = (amountMinor: number): Money => ({ amountMinor, currency: "NGN" });
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const store = { id: "store_ada", name: "Ada Fabrics", logoUrl: null };
const automatic: AffiliateProgrammeTerms = { defaultCommissionPercent: 10, attributionWindowDays: 30, approval: "automatic", autoApproveFollowersAbove: 1000, commissionPaidWhen: "order_completed" };
const manual: AffiliateProgrammeTerms = { ...automatic, approval: "manual", autoApproveFollowersAbove: null };

let links: AffiliateLink[] = [{ id: "link_dress", productId: "prod_dress", storeId: store.id, path: "/p/prod_dress?aff=link_dress", clicks: 412, createdAt: daysAgo(9) }];
let products: PromotableProduct[] = [
  { productId: "prod_dress", name: "Ankara wrap dress", imageUrl: null, price: ngn(2_500_000), stock: 14, store, commissionBasisPoints: 1000, commissionPercent: 10, estimatedCommission: ngn(250_000), access: "approved", link: links[0] ?? null, programme: automatic },
  { productId: "prod_scarf", name: "Silk head scarf", imageUrl: null, price: ngn(800_000), stock: 3, store, commissionBasisPoints: 1500, commissionPercent: 15, estimatedCommission: ngn(120_000), access: "open", link: null, programme: automatic },
  { productId: "prod_bag", name: "Woven raffia bag", imageUrl: null, price: ngn(1_200_000), stock: null, store: { id: "store_kemi", name: "Kemi Crafts", logoUrl: null }, commissionBasisPoints: 800, commissionPercent: 8, estimatedCommission: ngn(96_000), access: "approval_required", link: null, programme: manual },
];

const earnings: AffiliateEarning[] = [
  { id: "earn_p1", status: "pending", payoutStatus: "awaiting_completion", reason: "", orderNumber: "ZM-1042", product: { id: "prod_dress", name: "Ankara wrap dress" }, store: { id: store.id, name: store.name }, sale: ngn(2_500_000), commissionPercent: 10, commission: ngn(250_000), reversed: ngn(0), source: { source: "link", id: "link_dress" }, orderedAt: daysAgo(2), decidedAt: null, createdAt: daysAgo(2) },
  { id: "earn_e1", status: "earned", payoutStatus: "paid", reason: "", orderNumber: "ZM-0991", product: { id: "prod_dress", name: "Ankara wrap dress" }, store: { id: store.id, name: store.name }, sale: ngn(2_500_000), commissionPercent: 10, commission: ngn(250_000), reversed: ngn(0), source: { source: "post", id: "post_2" }, orderedAt: daysAgo(12), decidedAt: daysAgo(4), createdAt: daysAgo(4) },
  { id: "earn_r1", status: "reversed", payoutStatus: "not_paid", reason: "refunded", orderNumber: "ZM-0950", product: { id: "prod_dress", name: "Ankara wrap dress" }, store: { id: store.id, name: store.name }, sale: ngn(2_500_000), commissionPercent: 10, commission: ngn(0), reversed: ngn(250_000), source: { source: "live", id: "live_1" }, orderedAt: daysAgo(15), decidedAt: daysAgo(13), createdAt: daysAgo(15) },
];

function promotionOf(link: AffiliateLink): AffiliatePromotion {
  const product = products.find((candidate) => candidate.productId === link.productId);
  const completed = earnings.filter((earning) => earning.product.id === link.productId && earning.status === "earned").length;
  const pending = earnings.filter((earning) => earning.product.id === link.productId && earning.status === "pending").length;
  return {
    productId: link.productId, name: product?.name ?? "Product", imageUrl: product?.imageUrl ?? null, price: product?.price ?? ngn(0), stock: product?.stock ?? null, store: product?.store ?? store,
    commissionPercent: product?.commissionPercent ?? 0, access: product?.access ?? "approved", link, clicks: link.clicks, pendingOrders: pending, completedOrders: completed,
    reversedOrders: earnings.filter((earning) => earning.product.id === link.productId && earning.status === "reversed").length,
    conversionPercent: link.clicks > 0 ? ((pending + completed) * 100) / link.clicks : null, sales: ngn(completed * 2_500_000), earned: ngn(completed * 250_000), pendingEarnings: ngn(pending * 250_000),
    programme: product?.programme ?? null,
  };
}

const sum = (status: AffiliateEarning["status"], pick: (earning: AffiliateEarning) => Money) => {
  const total = earnings.filter((earning) => earning.status === status).reduce((amount, earning) => amount + pick(earning).amountMinor, 0);
  return total > 0 ? [ngn(total)] : [];
};

export const affiliatesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/creators/me/affiliate-catalog", ({ query }) => {
    const search = (query.get("q") ?? "").toLowerCase();
    const access = query.get("access");
    const filtered = products.filter((product) => product.name.toLowerCase().includes(search) && (!access || (access === "requestable" ? ["open", "approval_required"].includes(product.access) : product.access === access)));
    const sorted = query.get("sort") === "commission" ? [...filtered].sort((left, right) => right.commissionBasisPoints - left.commissionBasisPoints) : filtered;
    return { data: sorted, nextCursor: null };
  }),
  createMockRoute("GET", "/api/v1/creators/me/affiliate-promotions", () => ({ data: links.map(promotionOf), nextCursor: null })),
  createMockRoute("GET", "/api/v1/creators/me/affiliate-earnings", ({ query }) => {
    const status = query.get("status") ?? "pending";
    if (!["pending", "earned", "reversed"].includes(status)) throw new ApiError(400, "status must be pending, earned or reversed", "VALIDATION_FAILED");
    return {
      summary: { pending: sum("pending", (earning) => earning.commission), earned: sum("earned", (earning) => earning.commission), paid: sum("earned", (earning) => earning.commission), reversed: sum("reversed", (earning) => earning.reversed) },
      data: earnings.filter((earning) => earning.status === status), nextCursor: null,
    };
  }),
  createMockRoute("POST", "/api/v1/creators/me/affiliate-links", ({ body }) => {
    const productId = (body as { productId?: string } | null)?.productId ?? "";
    const product = products.find((candidate) => candidate.productId === productId);
    if (!product) throw new ApiError(404, "Product was not found.", "PRODUCT_NOT_FOUND");
    if (product.access === "approval_required" || product.access === "requested") {
      products = products.map((candidate) => (candidate.productId === productId ? { ...candidate, access: "requested" } : candidate));
      throw new ApiError(409, "The seller has to approve you before you can share this product.", "AFFILIATION_PENDING");
    }
    const existing = links.find((link) => link.productId === productId);
    if (existing) return existing;
    const link: AffiliateLink = { id: `link_${productId}`, productId, storeId: product.store.id, path: `/p/${productId}?aff=link_${productId}`, clicks: 0, createdAt: new Date().toISOString() };
    links = [link, ...links];
    products = products.map((candidate) => (candidate.productId === productId ? { ...candidate, access: "approved", link } : candidate));
    return link;
  }),
  createMockRoute("POST", "/api/v1/creators/affiliations", ({ body }) => {
    const productId = (body as { productId?: string } | null)?.productId ?? "";
    const product = products.find((candidate) => candidate.productId === productId);
    if (!product) throw new ApiError(404, "Product was not found.", "PRODUCT_NOT_FOUND");
    const status = product.access === "open" ? "active" : "requested";
    products = products.map((candidate) => (candidate.productId === productId ? { ...candidate, access: status === "active" ? "approved" : "requested" } : candidate));
    return { id: `aff_${productId}`, status };
  }),
];
