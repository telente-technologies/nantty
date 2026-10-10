import type { ID, ISODate, ProductSummary, UserSummary } from "./models.type";
import type { CurrencyCode, Money } from "./money.type";

export type ConnectionTab = "followers" | "following" | "shopped" | "suggested" | "blocked";

export interface ConnectionEntry extends UserSummary {
  readonly isFollowing: boolean;
}

export interface FollowRequest {
  readonly id: ID;
  readonly requester: UserSummary;
  readonly createdAt: ISODate;
}

export interface AccountSettings {
  readonly email: string;
  readonly phone: string | null;
  readonly theme: "light" | "dark" | "system";
  readonly language: "en";
  readonly countryCode: string | null;
  readonly pushNotificationsEnabled: boolean;
  readonly twoFactorEnabled: boolean;
}

export interface ShippingAddressInput {
  readonly fullName: string;
  readonly phone: string;
  readonly line1: string;
  readonly postalCode: string;
  readonly details: string;
  readonly countryId: string;
  readonly stateId: string | null;
  readonly lgaId: string | null;
  readonly cityId: string | null;
  readonly isDefault: boolean;
}

export type SellerDashboardPeriod = "live" | "yesterday" | "today" | "week" | "month" | "all";

export type IdentityDocumentType = "nin_slip" | "drivers_licence" | "voters_card" | "international_passport";

export interface SellerApplicationDraft {
  readonly storeName: string;
  readonly categoryId: string;
  readonly description: string;
  readonly phone: string;
  readonly addressLine: string;
  readonly city: string;
  readonly state: string;
  readonly identityDocumentType: IdentityDocumentType | null;
  readonly identityDocumentNumber: string;
  readonly identityDocumentPhotoUrl: string | null;
  readonly payoutBankCode: string;
  readonly payoutBankName: string;
  readonly payoutAccountNumber: string;
  readonly payoutAccountName: string;
}

export interface SellerApplicationInput {
  readonly storeName: string;
  readonly categoryId: string;
  readonly description: string;
  readonly phone: string;
  readonly addressLine: string;
  readonly city: string;
  readonly state: string;
  readonly identityDocument: {
    readonly documentType: IdentityDocumentType;
    readonly documentNumber: string;
    readonly documentPhotoUrl: string;
  };
  readonly payoutAccount: { readonly bankCode: string; readonly accountNumber: string };
}

export type SellerApplicationStatus = "pending" | "approved" | "rejected";

export interface SellerApplication {
  readonly id: ID;
  readonly status: SellerApplicationStatus;
  readonly storeName: string;
  readonly categoryName: string;
  readonly city: string;
  readonly state: string;
  readonly identityDocumentType: IdentityDocumentType;
  readonly identityDocumentNumberMasked: string;
  readonly payoutBankName: string;
  readonly payoutAccountNumberMasked: string;
  readonly submittedAt: ISODate;
  readonly reviewedAt: ISODate | null;
  readonly rejectionReason: string | null;
}

export interface StoreProductInput {
  readonly name: string;
  readonly description: string;
  readonly price: Money;
  readonly stock: number;
  readonly sizes: readonly string[];
  readonly colors: readonly string[];
  readonly imageUrls: readonly string[];
  readonly brandId?: string | null;
}

export interface StoreProduct extends Omit<ProductSummary, "stock">, Omit<StoreProductInput, "price" | "stock"> {
  readonly stock: number;
  readonly published: boolean;
}

export interface WithdrawalRequest {
  readonly payoutAccountId: ID;
  readonly amount: Money;
}

export interface PayoutAccountInput {
  readonly bankCode: string;
  readonly accountNumber: string;
}

export interface CountryOption {
  readonly countryCode: string;
  readonly countryName: string;
  readonly currency: CurrencyCode;
  readonly currencyName: string;
}

export type UsernameUnavailableReason = "taken" | "reserved" | "invalid" | "recently_used" | "withheld";

export interface UsernameAvailability {
  readonly available: boolean;
  readonly reason?: UsernameUnavailableReason;
  readonly suggestions?: readonly string[];
}

export interface UsernameChangeRecord {
  readonly from: string;
  readonly to: string;
  readonly changedAt: string;
  readonly reason: string;
}

export interface UsernamePolicy {
  readonly username: string;
  readonly canChangeNow: boolean;
  readonly cooldownDays: number;
  readonly maxChangesPerYear: number;
  readonly quarantineDays: number;
  readonly history: readonly UsernameChangeRecord[];
  readonly nextChangeAvailableAt: string | null;
  readonly changesRemainingThisYear: number;
  readonly rules: readonly string[];
}
