import type { Money } from "@/types/money.type";

export type ShippingDestinationLevel = "country" | "state" | "lga";
export type ShippingRuleType = "flat_fee" | "free";
export type ShippingOutcome = "fee" | "free_rule" | "free_threshold" | "not_deliverable";

export interface ShippingDestination {
  readonly level: ShippingDestinationLevel;
  readonly countryCode: string;
  readonly stateCode: string | null;
  readonly lgaName: string | null;
}

export interface ShippingZone {
  readonly id: string;
  readonly name: string;
  readonly destinations: ShippingDestination[];
}

export interface ShippingRule {
  readonly id: string;
  readonly zoneId: string;
  readonly type: ShippingRuleType;
  readonly fee: Money;
  readonly active: boolean;
}

export interface ShippingProfile {
  readonly id: string;
  readonly currency: Money["currency"];
  readonly pricedPer: "order_group";
  readonly freeShippingThreshold: Money | null;
  readonly zones: ShippingZone[];
  readonly rules: ShippingRule[];
  readonly updatedAt: string;
}

export interface ShippingRuleInput {
  readonly zoneName: string;
  readonly destinations: ShippingDestination[];
  readonly type: ShippingRuleType;
  readonly feeMinor: number;
  readonly active: boolean;
}

export interface ShippingCalculation {
  readonly outcome: ShippingOutcome;
  readonly fee: Money;
  readonly ruleId: string | null;
  readonly zoneName: string | null;
  readonly matchedLevel: ShippingDestinationLevel | null;
  readonly thresholdApplied: Money | null;
}

export interface ShippingCalculationSnapshot extends ShippingCalculation {
  readonly orderId: string;
  readonly destinationLabel: string;
  readonly orderSubtotal: Money;
  readonly feeCharged: Money;
  readonly calculatedAt: string;
}
