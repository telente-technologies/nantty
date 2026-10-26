import type { OfferClaim, OfferPreview } from "@/types/subscriptionOffer.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

let mockClaim: OfferClaim | null = null;

const naira = (amountMinor: number) => ({ amountMinor, currency: "NGN" as const });

const preview = (): OfferPreview => ({
  state: mockClaim ? "reserved_by_you" : "available", discount: { kind: "percentage", percentOff: 30 }, durationCycles: 3, singleUse: true, expiresAt: "2026-12-31T23:00:00.000Z", profileId: "p_me", claim: mockClaim,
  plans: [{
    planCode: "premium", planLabel: "Nantty Premium", availableForProfile: true,
    prices: [
      { interval: "month", listPrice: naira(450_000), regularPrice: naira(450_000), offerPrice: naira(315_000), offerApplies: true },
      { interval: "year", listPrice: naira(5_400_000), regularPrice: naira(4_320_000), offerPrice: naira(3_780_000), offerApplies: true },
    ],
  }],
});

export const subscriptionOfferMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/subscription-offers/:token", () => preview()),
  createMockRoute("POST", "/api/v1/subscription-offers/:token/claim", () => {
    mockClaim ??= { id: "claim_mock", status: "reserved", reservedUntil: new Date(Date.now() + 3_600_000).toISOString(), redeemedAt: null };
    return mockClaim;
  }),
];
