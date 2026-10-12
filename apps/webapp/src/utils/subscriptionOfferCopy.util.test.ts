import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OfferPreview } from "@/types/subscriptionOffer.type";

import { describeBlockedOffer, describeOfferHeadline, readOfferTokenFromPath } from "./subscriptionOfferCopy.util";

const offer = (overrides: Partial<OfferPreview>): OfferPreview => ({
  state: "available", discount: { kind: "percentage", percentOff: 30 }, plans: [{ planCode: "seller_pro", planLabel: "Pro plan", availableForProfile: true, prices: [] }],
  durationCycles: 1, singleUse: true, expiresAt: null, claim: null, ...overrides,
});

describe("subscription offer copy", () => {
  it("names the discount and the plans", () => {
    assert.equal(describeOfferHeadline(offer({})), "30% off Pro plan");
    assert.match(describeOfferHeadline(offer({ discount: { kind: "fixed_amount", amountOff: { amountMinor: 200_000, currency: "NGN" } } })), /2,000 off Pro plan$/);
  });

  it("explains every state that blocks claiming and none that allows it", () => {
    for (const state of ["expired", "revoked", "fully_claimed", "claimed_by_you", "not_for_profile", "wrong_currency"] as const) assert.ok(describeBlockedOffer(offer({ state })), state);
    assert.equal(describeBlockedOffer(offer({ state: "available" })), null);
    assert.equal(describeBlockedOffer(offer({ state: "reserved_by_you" })), null);
    assert.match(describeBlockedOffer(offer({ state: "fully_claimed" }))!.text, /someone else got there first/);
  });

  it("only accepts token shaped paths", () => {
    assert.equal(readOfferTokenFromPath("Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s"), "Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s");
    assert.equal(readOfferTokenFromPath("../admin"), null);
    assert.equal(readOfferTokenFromPath("short"), null);
  });
});
