import type { StoreRole } from "../../../constants/roles.constant.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { VerificationDetails } from "../../verifications/models/verifications.model.js";

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
  readonly currency: CurrencyCode;
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
  readonly currency: CurrencyCode;
  readonly shippingFee: number;
  readonly discountBps: number;
  readonly shippingPolicy: string;
  readonly returnPolicy: string;
  readonly logoUrl: string | null;
  readonly bannerUrl: string | null;
}

export type StoreChanges = Partial<
  Pick<StoreRecord, "name" | "description" | "logoUrl" | "bannerUrl" | "shippingPolicy" | "returnPolicy" | "shippingFee" | "discountBps" | "featured" | "currency">
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
  readonly onboarding: SellerOnboardingDetails | null;
  readonly status: SellerApplicationStatus;
  readonly reviewerId: string | null;
  readonly reviewNote: string | null;
  readonly reviewedAt: Date | null;
  readonly createdAt: Date;
}

export interface SellerOnboardingPayoutAccount {
  readonly bankCode: string;
  readonly bankName: string;
  readonly accountNumberEncrypted: string;
  readonly accountLast4: string;
  readonly accountName: string;
}

export interface SellerOnboardingDetails {
  readonly verification: VerificationDetails | null;
  readonly payoutAccount: SellerOnboardingPayoutAccount | null;
}

export type NewSellerApplicationInput = Pick<SellerApplicationRecord, "userId" | "storeName" | "description" | "categoryId" | "phoneEncrypted" | "onboarding">;

export const MAXIMUM_STORES_PER_OWNER = 5;
