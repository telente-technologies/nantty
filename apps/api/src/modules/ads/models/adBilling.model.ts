import type { CurrencyCode } from "../../../enums/currency.enum.js";

export type FundingMode = "prepaid" | "card" | "prepaid_and_card";
export type AdPaymentProvider = "paystack" | "flutterwave";
export type AdTopUpStatus = "pending" | "succeeded" | "failed" | "abandoned";

export interface AdTopUpRecord {
  readonly id: string;
  readonly accountId: string;
  readonly requestedById: string;
  readonly reference: string;
  readonly walletReference: string;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly provider: AdPaymentProvider;
  readonly status: AdTopUpStatus;
  readonly failureReason: string | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

export type NewAdTopUpInput = Omit<AdTopUpRecord, "id" | "status" | "failureReason" | "completedAt">;

export interface AdPaymentMethodRecord {
  readonly id: string;
  readonly accountId: string;
  readonly requestedById: string;
  readonly provider: AdPaymentProvider;
  readonly reference: string;
  readonly status: "pending" | "active" | "failed";
  readonly brand: string;
  readonly last4: string;
  readonly expMonth: number;
  readonly expYear: number;
  readonly isDefault: boolean;
  readonly authorizationCiphertext: string | null;
  readonly createdAt: Date;
}

export type NewAdPaymentMethodInput = Pick<AdPaymentMethodRecord, "accountId" | "requestedById" | "provider" | "reference" | "createdAt">;
export type AdPaymentMethodChanges = Partial<Pick<AdPaymentMethodRecord, "status" | "isDefault" | "authorizationCiphertext">>;

export interface TopUpLimits {
  readonly minimum: number;
  readonly maximum: number;
  readonly suggested: readonly number[];
  readonly lowBalance: number;
}

export const TOP_UP_LIMITS_BY_CURRENCY: Readonly<Record<string, TopUpLimits>> = {
  NGN: { minimum: 500_000, maximum: 500_000_000, suggested: [2_000_000, 5_000_000, 10_000_000, 25_000_000], lowBalance: 2_000_000 },
  GHS: { minimum: 5_000, maximum: 5_000_000, suggested: [20_000, 50_000, 100_000, 250_000], lowBalance: 20_000 },
  KES: { minimum: 50_000, maximum: 50_000_000, suggested: [200_000, 500_000, 1_000_000, 2_500_000], lowBalance: 200_000 },
  ZAR: { minimum: 10_000, maximum: 10_000_000, suggested: [50_000, 100_000, 250_000, 500_000], lowBalance: 50_000 },
};

export const FALLBACK_TOP_UP_LIMITS: TopUpLimits = { minimum: 1_000, maximum: 1_000_000, suggested: [2_000, 5_000, 10_000, 25_000], lowBalance: 2_000 };

export const VALUE_ADDED_TAX_BASIS_POINTS_BY_CURRENCY: Readonly<Record<string, number>> = { NGN: 750, GHS: 1500, KES: 1600, ZAR: 1500, GBP: 2000, EUR: 2000, USD: 0 };

export const CARD_VERIFICATION_AMOUNT_BY_CURRENCY: Readonly<Record<string, number>> = { NGN: 5_000, GHS: 100, KES: 1_000, ZAR: 200 };

export const RECEIPTED_TRANSACTION_TYPES: ReadonlySet<string> = new Set(["top_up", "refund", "card_charge"]);
