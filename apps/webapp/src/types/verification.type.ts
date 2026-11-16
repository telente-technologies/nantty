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
  readonly status: "active" | "pending_payment" | "past_due" | "paused" | "cancelled";
  readonly renewsAt: ISODate | null;
  readonly cancelAtPeriodEnd: boolean;
}

export interface BlackApplicationSummary {
  readonly id: ID;
  readonly agencyName: string;
  readonly handle: string;
  readonly status: "PENDING" | "IN_REVIEW" | "AWAITING_SECOND_APPROVAL" | "APPROVED" | "REVERIFICATION_REQUIRED" | "REJECTED" | "REVOKED";
  readonly legalIdentityName?: string;
  readonly legalRegistrationRef?: string;
  readonly jurisdictionCountryCode: string;
  readonly officialWebsite?: string;
  readonly officialContactPhone?: string;
  readonly institutionalEmail: string;
  readonly institutionalEmailVerified: boolean;
  readonly representativeName: string;
  readonly representativeRole: string;
  readonly representativeEmail?: string;
  readonly representativeIdRef?: string;
  readonly evidenceNotes?: string;
  readonly privateCheckoutEnabled: boolean;
  readonly privateCheckoutExpiresAt?: ISODate | null;
  readonly reverificationDueAt?: ISODate | null;
  readonly reverificationReason?: string | null;
  readonly decisionReason?: string | null;
  readonly handleReserved: boolean;
  readonly submittedAt: ISODate;
}

export interface BlackApplicationInput {
  readonly agencyName: string;
  readonly legalIdentityName: string;
  readonly legalRegistrationRef?: string;
  readonly jurisdictionCountryCode: string;
  readonly officialWebsite?: string;
  readonly officialContactPhone?: string;
  readonly institutionalEmail: string;
  readonly representativeName: string;
  readonly representativeRole: string;
  readonly representativeEmail?: string;
  readonly representativeIdRef?: string;
  readonly evidenceNotes?: string;
}

export interface GovernmentBlackBillingDashboard {
  readonly verification: {
    readonly applicationId: ID;
    readonly profileId: ID;
    readonly agencyName: string;
    readonly handle: string;
    readonly status: string;
    readonly jurisdictionCountryCode: string;
    readonly institutionalEmail: string;
    readonly institutionalEmailVerified: boolean;
    readonly privateCheckoutEnabled: boolean;
    readonly privateCheckoutExpiresAt?: ISODate | null;
    readonly reverificationDueAt?: ISODate | null;
  };
  readonly pricing: {
    readonly planCode: "black";
    readonly interval: "month";
    readonly currency: "USD";
    readonly price: Money;
    readonly annualBillingDisabled: true;
    readonly discountsDisabled: true;
    readonly recurringCardRequired: true;
    readonly recurringCardEnabled: boolean;
    readonly regionBasis: string;
  } | null;
  readonly disclosures: {
    readonly monthlyAmountFormatted: string;
    readonly currency: "USD";
    readonly billingCadence: string;
    readonly autoRenewalTerms: string;
    readonly nextBillingNotice: string;
    readonly cancellationTerms: string;
    readonly failureConsequences: string;
    readonly cardRemovalConsequences: string;
  } | null;
  readonly subscription: {
    readonly subscriptionId: ID;
    readonly status: string;
    readonly cardLabel?: string;
    readonly pausedReason?: string;
    readonly billingAuthorizationId?: string;
    readonly cardUsable: boolean;
    readonly currentPeriodEnd?: ISODate | null;
    readonly nextChargeAt?: ISODate | null;
    readonly cancelAtPeriodEnd: boolean;
  } | null;
  readonly invoices: readonly {
    readonly id: ID;
    readonly kind: string;
    readonly status: string;
    readonly amount: Money;
    readonly periodStartsAt: ISODate;
    readonly periodEndsAt: ISODate;
    readonly paidAt?: ISODate | null;
    readonly paymentReference?: string;
    readonly failureReason?: string;
    readonly invoiceNumber: string;
  }[];
  readonly events: readonly {
    readonly id: ID;
    readonly eventKind: string;
    readonly summary: string;
    readonly createdAt: ISODate;
  }[];
}

export interface SavedCardSummary {
  readonly authorizationId: string;
  readonly provider: string;
  readonly cardLabel: string;
  readonly brand?: string;
  readonly last4?: string;
  readonly expiryMonth: number;
  readonly expiryYear: number;
  readonly reusable: boolean;
  readonly usable: boolean;
  readonly purpose?: string;
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
  readonly blackApplication?: BlackApplicationSummary | null;
  readonly handleReserved?: boolean;
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

export interface CheckmarkSuggestionSummary {
  readonly color: "blue" | "gold";
  readonly eligible: boolean;
  readonly dismissed: boolean;
}
