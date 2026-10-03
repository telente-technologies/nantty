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

export interface WalletSummary {
  readonly available: Money;
  readonly pending: Money;
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
