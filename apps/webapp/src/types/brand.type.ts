import type { ID, Product, ProductSummary, StoreSummary, Verification } from "./models.type";
import type { CreatorProgramStatus } from "./social.type";

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
  readonly kind: "person" | "business" | "brand" | "store" | "government";
  readonly id: ID;
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
  readonly verification: Verification | null;
  readonly creatorStatus?: CreatorProgramStatus;
  readonly showsMart?: boolean;
  readonly onHold?: boolean;
}

export type LinkedProfileKind = "store" | "business" | "brand";

export interface LinkedProfileItem {
  readonly kind: LinkedProfileKind;
  readonly profileId: ID;
  readonly storeId: ID | null;
  readonly status: "active" | "held" | "retired";
  readonly holdReason: string | null;
  readonly name: string;
  readonly handle: string;
  readonly showsMart: boolean;
}

export interface LinkedProfiles {
  readonly accountId: ID;
  readonly items: readonly LinkedProfileItem[];
  readonly canCreate: { readonly store: boolean; readonly business: boolean; readonly brand: boolean };
  readonly choiceRequired: boolean;
}
