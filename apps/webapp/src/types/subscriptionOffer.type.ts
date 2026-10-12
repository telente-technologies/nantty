import type { Money } from "@/types/money.type";

export type OfferState = "available" | "reserved_by_you" | "claimed_by_you" | "expired" | "revoked" | "fully_claimed" | "not_for_profile" | "wrong_currency";
export type OfferInterval = "month" | "year";

export interface OfferIntervalPrice {
  readonly interval: OfferInterval;
  readonly listPrice: Money;
  readonly regularPrice: Money;
  readonly offerPrice: Money;
  readonly offerApplies: boolean;
}

export interface OfferPlanPreview {
  readonly planCode: string;
  readonly planLabel: string;
  readonly availableForProfile: boolean;
  readonly prices: readonly OfferIntervalPrice[];
}

export interface OfferClaim {
  readonly id: string;
  readonly status: "reserved" | "redeemed" | "released";
  readonly reservedUntil: string;
  readonly redeemedAt: string | null;
}

export interface OfferPreview {
  readonly state: OfferState;
  readonly discount: { readonly kind: "percentage" | "fixed_amount"; readonly percentOff?: number; readonly amountOff?: Money };
  readonly plans: readonly OfferPlanPreview[];
  readonly durationCycles: number;
  readonly singleUse: boolean;
  readonly expiresAt: string | null;
  readonly profileId?: string;
  readonly claim: OfferClaim | null;
}

export interface OfferCheckout {
  readonly subscriptionId: string;
  readonly authorizationUrl: string;
  readonly activated?: boolean;
  readonly offer?: { readonly claimId: string; readonly applied: boolean; readonly discount: Money };
}
