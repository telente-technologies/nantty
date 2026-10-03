import type { Money } from "@/types/money.type";

export type MarketingCampaignKind = "discount_code" | "product_discount" | "scheduled_sale" | "flash_sale" | "bundle" | "featured_products";
export type MarketingCampaignStatus = "draft" | "scheduled" | "active" | "ended" | "paused";

export interface MarketingCampaign {
  readonly id: string;
  readonly kind: MarketingCampaignKind;
  readonly name: string;
  readonly status: MarketingCampaignStatus;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly reach: number;
  readonly redemptions: number;
  readonly revenue: Money;
  readonly href: string;
}

export interface MarketingOverview {
  readonly activeCampaigns: number;
  readonly scheduledCampaigns: number;
  readonly redemptionsLast30Days: number;
  readonly revenueLast30Days: Money;
  readonly discountGivenLast30Days: Money;
  readonly campaigns: MarketingCampaign[];
}

export interface FlashSaleItem {
  readonly productId: string;
  readonly productName: string;
  readonly imageUrl: string | null;
  readonly originalPrice: Money;
  readonly salePrice: Money;
  readonly stockCap: number | null;
  readonly soldCount: number;
}

export interface FlashSale {
  readonly id: string;
  readonly name: string;
  readonly items: FlashSaleItem[];
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: MarketingCampaignStatus;
  readonly reach: number;
  readonly revenue: Money;
  readonly createdAt: string;
}

export interface FlashSaleInput {
  readonly name: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly items: { readonly productId: string; readonly salePriceMinor: number; readonly stockCap: number | null }[];
}

export interface BundleItem {
  readonly productId: string;
  readonly productName: string;
  readonly imageUrl: string | null;
  readonly quantity: number;
  readonly unitPrice: Money;
}

export interface ProductBundle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly items: BundleItem[];
  readonly bundlePrice: Money;
  readonly regularPrice: Money;
  readonly status: "active" | "paused" | "draft";
  readonly soldCount: number;
  readonly revenue: Money;
  readonly createdAt: string;
}

export interface ProductBundleInput {
  readonly name: string;
  readonly description: string;
  readonly bundlePriceMinor: number;
  readonly status: ProductBundle["status"];
  readonly items: { readonly productId: string; readonly quantity: number }[];
}

export type FeaturedPlacement = "storefront" | "mart";

export interface FeaturedProduct {
  readonly productId: string;
  readonly productName: string;
  readonly imageUrl: string | null;
  readonly price: Money;
  readonly placement: FeaturedPlacement;
  readonly position: number;
  readonly featuredSince: string;
  readonly views: number;
  readonly clicks: number;
}

export interface MarketingProductOption {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly price: Money;
}
