import type { CurrencyCode } from "../enums/currency.enum.js";
import type { StoreRole } from "../constants/roles.constant.js";
import type { MinorUnits } from "../types/money.type.js";

export interface StoreSummary {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly logoUrl: string | null;
  readonly bannerUrl: string | null;
  readonly featured: boolean;
  readonly createdAt: Date;
  readonly status: "active" | "suspended";
  readonly currency: CurrencyCode;
  readonly shippingFee: MinorUnits;
  readonly discountBps: number;
  readonly ratingAverage: number;
  readonly ratingCount: number;
}

export interface StoreAccess {
  assertStoreMember(userId: string, storeId: string, allowedRoles?: readonly StoreRole[]): Promise<void>;
  listStoreIdsForMember(userId: string): Promise<readonly string[]>;
  findPrimaryStoreIdForMember(userId: string): Promise<string | undefined>;
  findStoreSummaries(storeIds: readonly string[]): Promise<readonly StoreSummary[]>;
  updateStoreRating(storeId: string, ratingAverage: number, ratingCount: number): Promise<void>;
}
