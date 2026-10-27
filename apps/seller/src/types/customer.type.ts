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
  readonly nanttyUsername: string | null;
  readonly city: string | null;
  readonly tags: string[];
  readonly notes: CustomerNote[];
  readonly storeCreditBalance: Money;
  readonly storeCreditExpiresAt: string | null;
  readonly totalSpent: Money;
  readonly averageOrderValue: Money | null;
  readonly purchasesCount: number;
  readonly firstPurchaseAt: string | null;
  readonly lastPurchaseAt: string | null;
  readonly createdAt: string;
  readonly marketingOptIn: boolean;
}

export type CustomerType = "new" | "returning" | "no_orders";

export interface CustomerPurchase {
  readonly kind: "online_order";
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly total: Money;
  readonly itemsCount: number;
  readonly createdAt: string;
}

export interface CustomerGrowthPoint {
  readonly month: string;
  readonly newCustomers: number;
  readonly returningCustomers: number;
}

export interface CustomersSummary {
  readonly totalCustomers: number;
  readonly newThisMonth: number;
  readonly returningCustomers: number;
  readonly repeatRateBasisPoints: number;
  readonly averageOrderValue: Money;
  readonly totalRevenue: Money;
  readonly growth: CustomerGrowthPoint[];
}

export type CustomerSegmentRuleField = "total_spent" | "purchases_count" | "days_since_last_purchase" | "days_since_first_purchase" | "average_order_value" | "tag" | "marketing_opt_in" | "city";
export type CustomerSegmentRuleOperator = "at_least" | "at_most" | "equals";

export interface CustomerSegmentRule {
  readonly field: CustomerSegmentRuleField;
  readonly operator: CustomerSegmentRuleOperator;
  readonly value: number | string | boolean;
}

export interface CustomerSegment {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: "built_in" | "custom";
  readonly rules: CustomerSegmentRule[];
  readonly customerCount: number;
  readonly totalSpent: Money;
  readonly averageOrderValue: Money | null;
  readonly createdAt: string;
}

export interface CustomerSegmentInput {
  readonly name: string;
  readonly description: string;
  readonly rules: CustomerSegmentRule[];
}
