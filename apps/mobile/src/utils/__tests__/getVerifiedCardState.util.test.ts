import type { MyVerification, VerificationDiscounts } from "@/types/verification.type";

import { describeGetVerifiedDiscount, pickGetVerifiedDiscountHighlight, resolveGetVerifiedCardState } from "../getVerifiedCardState.util";

const nothing: MyVerification = { current: null, subscription: null, application: null };
const active: MyVerification = { ...nothing, current: { status: "active", type: "personal", color: "blue", tier: "VERIFIED", badgeVisible: true } };
const pending: MyVerification = { ...nothing, current: { status: "pending", type: "personal", color: "blue", tier: "VERIFIED", badgeVisible: false } };
const rejected: MyVerification = { ...nothing, application: { id: "a1", color: "blue", status: "rejected", submittedAt: "2026-10-01T00:00:00Z", rejectionReason: "Photo was blurry" } };
const expired: MyVerification = { ...nothing, current: { status: "expired", type: "business", color: "gold", tier: "PRO", badgeVisible: false } };

describe("get verified card state", () => {
  it("offers Blue to personal profiles and Gold to businesses", () => {
    expect(resolveGetVerifiedCardState({ profileType: "personal", myVerification: nothing, dismissedOnServer: false })).toEqual({ kind: "offer", color: "blue" });
    expect(resolveGetVerifiedCardState({ profileType: "business", myVerification: expired, dismissedOnServer: false })).toEqual({ kind: "offer", color: "gold" });
  });

  it("never shows to people who already have the checkmark, to government profiles, or before data loads", () => {
    expect(resolveGetVerifiedCardState({ profileType: "personal", myVerification: active, dismissedOnServer: false }).kind).toBe("hidden");
    expect(resolveGetVerifiedCardState({ profileType: "government", myVerification: nothing, dismissedOnServer: false }).kind).toBe("hidden");
    expect(resolveGetVerifiedCardState({ profileType: "personal", myVerification: undefined, dismissedOnServer: false }).kind).toBe("hidden");
  });

  it("shows the review state instead of a sales pitch while pending or after a rejection", () => {
    expect(resolveGetVerifiedCardState({ profileType: "personal", myVerification: pending, dismissedOnServer: false })).toEqual({ kind: "pending", color: "blue" });
    expect(resolveGetVerifiedCardState({ profileType: "personal", myVerification: rejected, dismissedOnServer: false })).toEqual({ kind: "rejected", color: "blue", reason: "Photo was blurry" });
  });

  it("stays hidden once dismissed for good on the server", () => {
    expect(resolveGetVerifiedCardState({ profileType: "personal", myVerification: nothing, dismissedOnServer: true }).kind).toBe("hidden");
  });
});

describe("get verified discount", () => {
  const offer = { linkId: "l1", token: "t".repeat(43), plans: [{ planCode: "blue", planLabel: "Blue" }], discount: { kind: "percentage" as const, percentOff: 40 }, durationCycles: 1, expiresAt: null, sentAt: "2026-10-10T00:00:00Z" };
  const discounts: VerificationDiscounts = { offers: [offer], yearlyPercentOff: 20, bundle: { percentOff: 15 } };

  it("prefers an emailed offer, then the bundle for Gold, then the yearly saving", () => {
    expect(pickGetVerifiedDiscountHighlight(discounts, "blue")).toEqual({ kind: "offerLink", offer });
    expect(pickGetVerifiedDiscountHighlight(discounts, "gold")).toEqual({ kind: "bundle", percentOff: 15 });
    expect(pickGetVerifiedDiscountHighlight({ ...discounts, offers: [], bundle: null }, "blue")).toEqual({ kind: "yearly", percentOff: 20 });
    expect(pickGetVerifiedDiscountHighlight({ offers: [], yearlyPercentOff: 0, bundle: null }, "blue")).toBeNull();
  });

  it("describes fixed amount offers in the offer currency", () => {
    const fixed = { ...offer, discount: { kind: "fixed_amount" as const, amountOff: { amountMinor: 200_000, currency: "NGN" as const } } };
    expect(describeGetVerifiedDiscount({ kind: "offerLink", offer: fixed }, (amount, currency) => `${currency} ${amount / 100}`)).toBe("You have an offer: NGN 2000 off, sent to your email.");
  });
});
