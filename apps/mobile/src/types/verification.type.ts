import type { IdentityDocumentType } from "./account.type";
import type { ID, ISODate, Verification, VerificationColor, VerificationTier } from "./models.type";
import type { Money } from "./money.type";

export interface VerificationPerk {
  readonly title: string;
  readonly description: string;
}

export interface VerificationPlan {
  readonly id: ID;
  readonly color: Exclude<VerificationColor, "black">;
  readonly tier: VerificationTier;
  readonly price: Money;
  readonly interval: "month" | "year";
  readonly perks: readonly VerificationPerk[];
}

export interface VerificationSubscription {
  readonly planId: ID;
  readonly status: "active" | "pending_payment" | "past_due" | "cancelled";
  readonly renewsAt: ISODate | null;
  readonly cancelAtPeriodEnd: boolean;
}

export interface VerificationApplicationSummary {
  readonly id: ID;
  readonly color: Exclude<VerificationColor, "black">;
  readonly status: "pending" | "approved" | "rejected";
  readonly submittedAt: ISODate;
  readonly rejectionReason: string | null;
}

export interface MyVerification {
  readonly current: Verification | null;
  readonly subscription: VerificationSubscription | null;
  readonly application: VerificationApplicationSummary | null;
}

export type VerificationApplicationInput =
  | {
      readonly kind: "blue";
      readonly planId: ID;
      readonly legalName: string;
      readonly identityDocument: { readonly documentType: IdentityDocumentType; readonly documentNumber: string; readonly documentPhotoUrl: string };
      readonly selfiePhotoUrl: string;
    }
  | {
      readonly kind: "gold";
      readonly planId: ID;
      readonly businessName: string;
      readonly businessRegistrationNumber: string;
      readonly businessAddress: string;
      readonly documentUrls: readonly string[];
    };

export interface VerificationCheckout {
  readonly applicationId: ID;
  readonly checkoutUrl: string;
}

export interface VerificationOfferDiscount {
  readonly linkId: ID;
  readonly token: string;
  readonly plans: readonly { readonly planCode: string; readonly planLabel: string }[];
  readonly discount: { readonly kind: "percentage" | "fixed_amount"; readonly percentOff?: number; readonly amountOff?: Money };
  readonly durationCycles: number;
  readonly expiresAt: ISODate | null;
  readonly sentAt: ISODate;
}

export interface VerificationDiscounts {
  readonly offers: readonly VerificationOfferDiscount[];
  readonly yearlyPercentOff: number;
  readonly bundle: { readonly percentOff: number } | null;
}
