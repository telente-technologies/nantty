import { describe, expect, it } from "vitest";

import { subscriptionOfferSent } from "../src/modules/eventIngestion/mappings/subscriptionOffers.mapping.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { eventFixtures } from "./fixtures/eventFixtures.fixture.js";
import { makeEvent } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };
const base = eventFixtures["subscriptionOffer.sent"]!.data as Record<string, unknown>;
const run = (data: Record<string, unknown>) => subscriptionOfferSent(makeEvent("subscriptionOffer.sent", data), new EventDataReader(data), context);

describe("subscriptionOffer.sent", () => {
  it("emails the raw recipient address without needing an account", () => {
    const [intent] = run(base);
    expect(intent?.emailAddressOverride).toBe("ada@example.com");
    expect(intent?.recipientUserId).toBe("offer:ada@example.com");
    expect(intent?.inApp).toBeUndefined();
    const plan = intent!.email!(makeRecipient({ accountId: "offer:ada@example.com" }));
    expect(plan.props).toMatchObject({ planLabels: ["Pro plan"], percentOff: 30, durationCycles: 2, note: "Welcome to the pilot.", singleUse: true });
    expect(plan.props).not.toHaveProperty("expiresAt");
  });

  it("uses the fixed amount when there is one", () => {
    const [intent] = run({ ...base, discountKind: "fixed_amount", percentOff: undefined, amountOff: { amountMinor: 200000, currency: "NGN" } });
    expect(intent!.email!(makeRecipient({})).props).toMatchObject({ amountOff: { amountMinor: 200000, currency: "NGN" } });
  });

  it("drops events whose claim link isn't an offer link", () => {
    expect(run({ ...base, claimUrl: "javascript:alert(1)" })).toHaveLength(0);
    expect(run({ ...base, claimUrl: "https://evil.example/phish" })).toHaveLength(0);
  });

  it("gives each send its own delivery key", () => {
    const first = run(base)[0]!;
    const second = run({ ...base, sendId: "send2" })[0]!;
    expect(first.variant).not.toBe(second.variant);
  });
});
