import type { Money } from "./money.type";
import type { ID, ISODate } from "./primitive.type";
import type { SponsoredPlacement } from "./sponsoredPlacement.type";
import type { Verification } from "./identityModels.type";

export interface Topic {
  readonly id: ID;
  readonly name: string;
}

export interface Category {
  readonly id: ID;
  readonly name: string;
}

export interface StoreSummary {
  readonly id: ID;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly rating: number;
  readonly ratingCount: number;
  readonly reviewCount: number;
  readonly verification?: Verification | null;
  readonly successRate?: number | null;
  readonly earnBackBasisPoints?: number | null;
}

export interface ProductStoreSummary extends StoreSummary {
  readonly isFollowing?: boolean;
}

export interface ProductVariantGroup {
  readonly name: string;
  readonly options: readonly string[];
}

export interface ProductVariant {
  readonly id: ID;
  readonly title: string;
  readonly size: string;
  readonly color: string;
  readonly price: Money;
  readonly approxPrice?: Money | null;
  readonly priceIsRegional?: boolean;
  readonly inStock: boolean;
  readonly optionValues: Readonly<Record<string, string>>;
}

export interface ProductSummary {
  readonly id: ID;
  readonly name: string;
  readonly storeName?: string | null;
  readonly storeVerified?: boolean;
  readonly price: Money;
  readonly approxPrice?: Money | null;
  readonly priceIsRegional?: boolean;
  readonly imageUrl: string | null;
  readonly liked?: boolean;
  readonly bookmarked?: boolean;
  readonly saveCount?: number;
  readonly stock?: number;
  readonly sponsored?: SponsoredPlacement | null;
}

export interface Product extends ProductSummary {
  readonly images: readonly string[];
  readonly title: string;
  readonly rating: number;
  readonly promo: string | null;
  readonly sizes: readonly string[];
  readonly colors: readonly string[];
  readonly variantGroups?: readonly ProductVariantGroup[] | null;
  readonly variants?: readonly ProductVariant[];
  readonly shippingInfo: string;
  readonly description: string;
  readonly attributes?: readonly ProductAttribute[];
  readonly store: ProductStoreSummary;
  readonly related: readonly ProductSummary[];
}

export interface ProductAttribute {
  readonly name: string;
  readonly value: string;
}

export interface StoreCreditBalance {
  readonly storeId: ID;
  readonly storeName: string;
  readonly logoUrl: string | null;
  readonly balance: Money;
  readonly expiresAt: ISODate | null;
  readonly earnBackBasisPoints: number | null;
}
