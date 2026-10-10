import type { ID, ISODate, ProductSummary } from "./models.type";
import type { Money } from "./money.type";
import type { Order } from "./cartOrder.type";

export type VerificationNextStep = "payout_setup" | "bank_validation" | "business_verification" | "identity_check";

export type WalletLineKey = "available" | "pending" | "locked" | "earningsPayable" | "adCredit" | "coins" | "debts";

export interface WalletLineAmount {
  readonly amountMinor: number;
  readonly currency: Money["currency"] | "COIN";
}

export interface WalletLine {
  readonly key: WalletLineKey | (string & {});
  readonly label: string;
  readonly description: string;
  readonly amount: WalletLineAmount;
}

export interface WalletVerification {
  readonly level: number;
  readonly withdrawalsUnlocked: boolean;
  readonly waitingForVerification: Money;
  readonly nextStep: VerificationNextStep | (string & {}) | null;
  readonly message: string | null;
}

export interface WalletSummary {
  readonly available: Money;
  readonly pending: Money;
  readonly locked?: Money;
  readonly inEscrow?: Money;
  readonly payoutRequested?: Money;
  readonly negativeBalance?: Money;
  readonly nextAvailableAt?: ISODate | null;
  readonly adCredit?: Money;
  readonly earningsPayable?: Money;
  readonly debts?: Money;
  readonly coins?: { readonly spendable: number; readonly earned: number };
  readonly lines?: readonly WalletLine[];
  readonly verification?: WalletVerification | null;
}

export interface WalletTransaction {
  readonly id: ID;
  readonly kind: "credit" | "debit";
  readonly amount: Money;
  readonly description: string;
  readonly createdAt: ISODate;
  readonly status: "pending" | "completed" | "failed";
}

export interface PayoutAccount {
  readonly id: ID;
  readonly bankName: string;
  readonly accountNumberMasked: string;
  readonly accountName: string;
}

export interface SellerDashboard {
  readonly totalSales: Money;
  readonly orders: number;
  readonly series: readonly { readonly label: string; readonly value: number }[];
  readonly recentOrders: readonly Order[];
  readonly inventory: readonly ProductSummary[];
}
