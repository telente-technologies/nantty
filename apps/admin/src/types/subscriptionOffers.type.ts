import type { Money } from "@/types/api.type";

export type OfferDiscountKind = "percentage" | "fixed_amount";
export type OfferLinkStatus = "active" | "expired" | "revoked" | "fully_claimed";
export type OfferClaimStatus = "reserved" | "redeemed" | "released";

export interface OfferPlanLabel {
  readonly planCode: string;
  readonly planLabel: string;
}

export interface OfferDiscount {
  readonly kind: OfferDiscountKind;
  readonly percentOff?: number;
  readonly amountOff?: Money;
}

export interface OfferLinkSend {
  readonly id: string;
  readonly recipientEmail: string;
  readonly note: string;
  readonly sentByStaffId: string;
  readonly sentAt: string;
}

export interface OfferLinkClaim {
  readonly id: string;
  readonly accountId: string;
  readonly profileId: string;
  readonly status: OfferClaimStatus;
  readonly subscriptionId?: string;
  readonly reservedUntil: string;
  readonly redeemedAt: string | null;
  readonly claimedAt: string;
}

export interface OfferLink {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly status: OfferLinkStatus;
  readonly plans: readonly OfferPlanLabel[];
  readonly discount: OfferDiscount;
  readonly singleUse: boolean;
  readonly maxClaims: number;
  readonly claimedCount: number;
  readonly redeemedCount: number;
  readonly durationCycles: number;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly createdByStaffId: string;
  readonly createdAt: string;
  readonly sends: readonly OfferLinkSend[];
  readonly claims: readonly OfferLinkClaim[];
}

export interface OfferLinkList {
  readonly data: readonly OfferLink[];
}

export interface NewOfferLinkInput {
  readonly label: string;
  readonly planCodes: readonly string[];
  readonly discountKind: OfferDiscountKind;
  readonly percentOff?: number;
  readonly amountOff?: Money;
  readonly singleUse: boolean;
  readonly maxClaims?: number;
  readonly durationCycles: number;
  readonly expiresAt?: string;
}

export interface SendOfferLinkInput {
  readonly recipientEmails: readonly string[];
  readonly note: string;
}
