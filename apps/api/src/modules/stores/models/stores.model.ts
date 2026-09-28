import type { StoreRole } from "../../../constants/roles.constant.js";

export type StoreStatus = "active" | "suspended";
export type SellerApplicationStatus = "pending" | "approved" | "rejected";

export interface StoreRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly logoUrl: string | null;
  readonly bannerUrl: string | null;
  readonly status: StoreStatus;
  readonly featured: boolean;
  readonly shippingPolicy: string;
  readonly returnPolicy: string;
  readonly shippingFee: number;
  readonly discountBps: number;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewStoreInput {
  readonly ownerId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly shippingFee: number;
  readonly discountBps: number;
  readonly shippingPolicy: string;
  readonly returnPolicy: string;
  readonly logoUrl: string | null;
  readonly bannerUrl: string | null;
}

export type StoreChanges = Partial<
  Pick<StoreRecord, "name" | "description" | "logoUrl" | "bannerUrl" | "shippingPolicy" | "returnPolicy" | "shippingFee" | "discountBps" | "featured">
>;

export interface StoreFilter {
  readonly featured?: boolean;
  readonly includeSuspended?: boolean;
}

export interface StoreMemberRecord {
  readonly storeId: string;
  readonly userId: string;
  readonly role: StoreRole;
  readonly createdAt: Date;
}

export interface SellerApplicationRecord {
  readonly id: string;
  readonly userId: string;
  readonly storeName: string;
  readonly description: string;
  readonly categoryId: string | null;
  readonly phoneEncrypted: string;
  readonly status: SellerApplicationStatus;
  readonly reviewerId: string | null;
  readonly reviewNote: string | null;
  readonly reviewedAt: Date | null;
  readonly createdAt: Date;
}

export type NewSellerApplicationInput = Pick<SellerApplicationRecord, "userId" | "storeName" | "description" | "categoryId" | "phoneEncrypted">;

export const MAXIMUM_STORES_PER_OWNER = 5;
