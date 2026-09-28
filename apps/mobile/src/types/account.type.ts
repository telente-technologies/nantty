import type { ID, ISODate, Kobo, ProductSummary, UserSummary } from "./models.type";

export type ConnectionTab = "followers" | "following" | "shopped" | "suggested" | "blocked";

export interface ConnectionEntry extends UserSummary {
  readonly isFollowing: boolean;
}

export interface AccountSettings {
  readonly email: string;
  readonly phone: string | null;
  readonly theme: "light" | "dark" | "system";
  readonly language: "en";
  readonly pushNotificationsEnabled: boolean;
  readonly twoFactorEnabled: boolean;
}

export interface ShippingAddressInput {
  readonly fullName: string;
  readonly phone: string;
  readonly line1: string;
  readonly city: string;
  readonly state: string;
  readonly isDefault: boolean;
}

export type SellerDashboardPeriod = "live" | "yesterday" | "today" | "week" | "month" | "all";

export interface SellerApplicationInput {
  readonly storeName: string;
  readonly category: string;
  readonly phone: string;
  readonly address: string;
  readonly description: string;
}

export interface SellerApplication extends SellerApplicationInput {
  readonly id: ID;
  readonly status: "pending" | "approved" | "rejected";
  readonly submittedAt: ISODate;
}

export interface StoreProductInput {
  readonly name: string;
  readonly description: string;
  readonly price: Kobo;
  readonly stock: number;
  readonly sizes: readonly string[];
  readonly colors: readonly string[];
  readonly imageUrls: readonly string[];
}

export interface StoreProduct extends Omit<ProductSummary, "stock">, Omit<StoreProductInput, "price" | "stock"> {
  readonly stock: number;
  readonly published: boolean;
}

export interface WithdrawalRequest {
  readonly payoutAccountId: ID;
  readonly amount: Kobo;
}

export interface PayoutAccountInput {
  readonly bankCode: string;
  readonly accountNumber: string;
}
