import { findMarketingProductOptionOrThrow, isMarketingFeatureAvailableForRequest, listMarketingProductOptions, readMarketingState, requireMarketingPlanFeature } from "@/mocks/handlers/marketingState.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { FeaturedPlacement, FeaturedProduct, MarketingCampaign, MarketingCampaignKind, MarketingCampaignStatus, MarketingOverview } from "@/types/marketing.type";
import type { Promotion } from "@/types/promotion.type";
import { derivePromotionStatusFromSchedule } from "@/utils/promotionValidation.util";

const promotionKindToCampaignKind: Record<Promotion["kind"], MarketingCampaignKind> = { coupon: "discount_code", automatic: "product_discount", scheduled_sale: "scheduled_sale" };
const promotionStatusToCampaignStatus: Record<Promotion["status"], MarketingCampaignStatus> = { active: "active", scheduled: "scheduled", expired: "ended", disabled: "paused" };

function estimateAverageOrderMinor(): number {
  const orders = readMockDatabase().onlineOrders;
  return orders.length > 0 ? Math.round(orders.reduce((sum, order) => sum + order.total.amountMinor, 0) / orders.length) : 0;
}

function convertPromotionToCampaign(promotion: Promotion, averageOrderMinor: number): MarketingCampaign {
  const status = promotion.status === "disabled" ? "disabled" : derivePromotionStatusFromSchedule(promotion);
  return {
    id: promotion.id,
    kind: promotionKindToCampaignKind[promotion.kind],
    name: promotion.name,
    status: promotionStatusToCampaignStatus[status],
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    reach: promotion.usedCount * 17 + (promotion.code ? 240 : 610),
    redemptions: promotion.usedCount,
    revenue: { amountMinor: promotion.usedCount * averageOrderMinor, currency: readMockDatabase().settings.currency },
    href: `/promotions/${promotion.id}`,
  };
}

function buildMarketingOverview(request: MockRequest): MarketingOverview {
  const database = readMockDatabase();
  const currency = database.settings.currency;
  const averageOrderMinor = estimateAverageOrderMinor();
  const campaigns: MarketingCampaign[] = database.promotions.map((promotion) => convertPromotionToCampaign(promotion, averageOrderMinor));
  if (isMarketingFeatureAvailableForRequest(request)) {
    const state = readMarketingState();
    for (const sale of state.flashSales) campaigns.push({ id: sale.id, kind: "flash_sale", name: sale.name, status: sale.status, startsAt: sale.startsAt, endsAt: sale.endsAt, reach: sale.reach, redemptions: sale.items.reduce((sum, item) => sum + item.soldCount, 0), revenue: sale.revenue, href: "/marketing/flash-sales" });
    for (const bundle of state.bundles) campaigns.push({ id: bundle.id, kind: "bundle", name: bundle.name, status: bundle.status === "active" ? "active" : bundle.status, startsAt: bundle.createdAt, endsAt: null, reach: bundle.soldCount * 23, redemptions: bundle.soldCount, revenue: bundle.revenue, href: "/marketing/bundles" });
    if (state.featuredProducts.length > 0) {
      campaigns.push({ id: "featured_products", kind: "featured_products", name: `${state.featuredProducts.length} featured products`, status: "active", startsAt: state.featuredProducts.map((item) => item.featuredSince).sort()[0] ?? null, endsAt: null, reach: state.featuredProducts.reduce((sum, item) => sum + item.views, 0), redemptions: state.featuredProducts.reduce((sum, item) => sum + item.clicks, 0), revenue: { amountMinor: 0, currency }, href: "/marketing/featured" });
    }
  }
  const recentRedemptions = campaigns.reduce((sum, campaign) => sum + (campaign.status === "ended" && campaign.endsAt && Date.now() - new Date(campaign.endsAt).getTime() > 30 * 86_400_000 ? 0 : campaign.redemptions), 0);
  const recentRevenueMinor = campaigns.reduce((sum, campaign) => sum + campaign.revenue.amountMinor, 0);
  return {
    activeCampaigns: campaigns.filter((campaign) => campaign.status === "active").length,
    scheduledCampaigns: campaigns.filter((campaign) => campaign.status === "scheduled").length,
    redemptionsLast30Days: recentRedemptions,
    revenueLast30Days: { amountMinor: recentRevenueMinor, currency },
    discountGivenLast30Days: { amountMinor: Math.round(recentRevenueMinor * 0.11), currency },
    campaigns: campaigns.sort((first, second) => (second.startsAt ?? "").localeCompare(first.startsAt ?? "")),
  };
}

function readFeaturedItemsInput(request: MockRequest): { productId: string; placement: FeaturedPlacement }[] {
  const body = readJsonObjectBody(request);
  if (!Array.isArray(body.items)) throw new MockHttpError(400, "VALIDATION_FAILED", "Send items as a list.");
  const items = (body.items as Record<string, unknown>[]).map((item) => ({ productId: String(item.productId ?? ""), placement: (item.placement === "mart" ? "mart" : "storefront") as FeaturedPlacement }));
  if (items.length > 12) throw new MockHttpError(400, "VALIDATION_FAILED", "Feature up to 12 products.");
  if (new Set(items.map((item) => item.productId)).size !== items.length) throw new MockHttpError(400, "VALIDATION_FAILED", "Each product can only be featured once.");
  if (items.filter((item) => item.placement === "mart").length > 4) throw new MockHttpError(400, "VALIDATION_FAILED", "Up to 4 products can be featured in Mart.");
  return items;
}

export function registerMarketingOverviewMockRoutes(): void {
  registerMockRoute("GET", "/seller/marketing/overview", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, buildMarketingOverview(request));
  });

  registerMockRoute("GET", "/seller/marketing/product-options", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: listMarketingProductOptions(request.query.get("q")), nextCursor: null });
  });

  registerMockRoute("GET", "/seller/marketing/featured-products", (request) => {
    requireMarketingPlanFeature(request);
    return respondWithJson(200, { data: readMarketingState().featuredProducts.filter((featured) => featured.placement === "mart"), nextCursor: null });
  });

  registerMockRoute("PUT", "/seller/marketing/featured-products", (request) => {
    requireMarketingPlanFeature(request);
    const state = readMarketingState();
    const items = readFeaturedItemsInput(request).slice(0, 4);
    state.featuredProducts = items.map((item, index): FeaturedProduct => {
      const existing = state.featuredProducts.find((featured) => featured.productId === item.productId);
      const option = findMarketingProductOptionOrThrow(item.productId, `items.${index}.productId`);
      return { productId: option.productId, productName: option.name, imageUrl: option.imageUrl, price: option.price, placement: "mart", position: index + 1, featuredSince: existing?.featuredSince ?? new Date().toISOString(), views: existing?.views ?? 0, clicks: existing?.clicks ?? 0 };
    });
    return respondWithJson(200, { data: state.featuredProducts, nextCursor: null });
  });
}
