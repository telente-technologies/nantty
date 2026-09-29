import type { Money } from "@/types/money.type";

export interface CustomerNote {
  readonly id: string;
  readonly body: string;
  readonly author: { readonly id: string; readonly name: string };
  readonly createdAt: string;
}

export interface Customer {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly zudomartUsername: string | null;
  readonly tags: string[];
  readonly notes: CustomerNote[];
  readonly loyaltyPoints: number;
  readonly totalSpent: Money;
  readonly purchasesCount: number;
  readonly lastPurchaseAt: string | null;
  readonly createdAt: string;
  readonly marketingOptIn: boolean;
}

export interface CustomerPurchase {
  readonly kind: "pos_sale" | "online_order";
  readonly id: string;
  readonly reference: string;
  readonly total: Money;
  readonly itemsCount: number;
  readonly createdAt: string;
}
