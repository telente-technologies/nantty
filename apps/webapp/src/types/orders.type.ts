import type { ID, ISODate, ProductSummary, StoreSummary, UserSummary } from "./models.type";
import type { Money } from "./money.type";

export interface CartItem {
  readonly id: ID;
  readonly product: ProductSummary;
  readonly quantity: number;
  readonly variant: string | null;
  readonly store?: StoreSummary | null;
}

export interface Cart {
  readonly items: readonly CartItem[];
  readonly itemsTotal: Money;
  readonly shopDiscount: Money;
  readonly storeCredit: Money;
  readonly shipping: Money;
  readonly total: Money;
}

export type PaymentMode = "escrow" | "direct";

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "completed" | "cancelled" | "disputed";

export interface Order {
  readonly id: ID;
  readonly reference: string;
  readonly status: OrderStatus;
  readonly items: readonly CartItem[];
  readonly total: Money;
  readonly buyer: UserSummary;
  readonly store: StoreSummary;
  readonly createdAt: ISODate;
  readonly escrowReleaseAt: ISODate | null;
  readonly paymentMode?: PaymentMode;
  readonly fulfilmentStatus?: string;
}

export interface Address {
  readonly id: ID;
  readonly fullName: string;
  readonly phone: string;
  readonly line1: string;
  readonly city: string;
  readonly state: string;
  readonly isDefault: boolean;
  readonly countryId: string;
  readonly countryCode: string;
  readonly country: string;
  readonly stateId: string | null;
  readonly lgaId: string | null;
  readonly lga: string | null;
  readonly cityId: string | null;
  readonly postalCode: string;
  readonly details: string;
}

export type WalletLineKey = "available" | "pending" | "locked" | "earningsPayable" | "adCredit" | "coins" | "debts";

export interface WalletLine {
  readonly key: WalletLineKey | (string & {});
  readonly label: string;
  readonly description: string;
  readonly amount: { readonly amountMinor: number; readonly currency: Money["currency"] | "COIN" };
}

export type PayoutVerificationNextStep = "payout_setup" | "bank_validation" | "identity_check" | "business_verification";

export interface WalletVerification {
  readonly level: 0 | 1 | 2;
  readonly withdrawalsUnlocked: boolean;
  readonly waitingForVerification: Money;
  readonly nextStep: PayoutVerificationNextStep | (string & {}) | null;
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
