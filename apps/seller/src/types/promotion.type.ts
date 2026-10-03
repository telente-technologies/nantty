import type { Money } from "@/types/money.type";

export type PromotionStatus = "scheduled" | "active" | "expired" | "disabled";

export interface Promotion {
  readonly id: string;
  readonly name: string;
  readonly kind: "coupon" | "automatic" | "scheduled_sale";
  readonly code: string | null;
  readonly discount: { readonly kind: "percent" | "amount"; readonly value: number };
  readonly scope: { readonly kind: "all" | "products" | "categories"; readonly ids: string[] };
  readonly minimumSpend: Money | null;
  readonly usageLimit: number | null;
  readonly usageLimitPerCustomer: number | null;
  readonly usedCount: number;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly status: PromotionStatus;
  readonly createdAt: string;
}
