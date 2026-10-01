import type { ID, Product, ProductSummary, StoreSummary, Verification } from "./models.type";

export interface BrandSummary {
  readonly id: ID;
  readonly name: string;
  readonly handle: string;
  readonly logoUrl: string | null;
  readonly verification: Verification | null;
  readonly followers: number;
  readonly officialStoreId: ID | null;
}

export interface BrandDetail extends BrandSummary {
  readonly coverUrl: string | null;
  readonly categoryName: string;
  readonly description: string;
  readonly website: string | null;
  readonly isFollowing: boolean;
  readonly ownerUserId: ID | null;
  readonly officialStore: StoreSummary | null;
}

export interface BrandTag {
  readonly id: ID;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly verification: Verification | null;
}

export interface BrandedProduct extends Product {
  readonly brand?: BrandTag | null;
  readonly isOfficialStore?: boolean;
}

export interface BrandProducts {
  readonly officialStoreProducts: readonly ProductSummary[];
  readonly otherSellersProducts: readonly ProductSummary[];
}

export interface NewBrandInput {
  readonly name: string;
  readonly handle: string;
  readonly logoUrl: string | null;
  readonly coverUrl: string | null;
  readonly categoryId: string;
  readonly description: string;
  readonly website: string | null;
}

export interface ActingProfile {
  readonly kind: "person" | "brand" | "store";
  readonly id: ID;
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
  readonly verification: Verification | null;
}
