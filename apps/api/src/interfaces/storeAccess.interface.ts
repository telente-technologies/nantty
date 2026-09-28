import type { StoreRole } from "../constants/roles.constant.js";
import type { Kobo } from "../types/money.type.js";

export interface StoreSummary {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly slug: string;
  readonly logoUrl: string | null;
  readonly status: "active" | "suspended";
  readonly shippingFee: Kobo;
  readonly discountBps: number;
  readonly ratingAverage: number;
  readonly ratingCount: number;
}

export interface StoreAccess {
  assertStoreMember(userId: string, storeId: string, allowedRoles?: readonly StoreRole[]): Promise<void>;
  listStoreIdsForMember(userId: string): Promise<readonly string[]>;
  findStoreSummaries(storeIds: readonly string[]): Promise<readonly StoreSummary[]>;
  updateStoreRating(storeId: string, ratingAverage: number, ratingCount: number): Promise<void>;
}
