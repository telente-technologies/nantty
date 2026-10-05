import type { ID, ISODate, ProductSummary } from "./models.type";
import type { Money } from "./money.type";
import type { Order } from "./cartOrder.type";

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
