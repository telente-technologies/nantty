import { describe, expect, it } from "vitest";

import { eventMappings } from "../src/modules/eventIngestion/mappings/eventMappingRegistry.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";
import { makeEvent } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };
const ngn = (amountMinor: number) => ({ amountMinor, currency: "NGN" });
const clawedBack = {
  escrowId: "e1", orderId: "o1", orderNumber: "ZM-48213", buyerUserId: "buyer1", sellerUserId: "seller1", status: "clawedBack", amount: ngn(1_000_000), refunded: ngn(971_000),
  refundBreakdown: { refundedToBuyer: ngn(971_000), escrowFeeKept: ngn(15_000), processingFeeKept: ngn(14_000) },
};

describe("refund after the seller was paid", () => {
  it("tells the buyer what came back and which Zudomart fees were kept", () => {
    const mapping = eventMappings["escrow.clawedBack"];
    expect(mapping).toBeDefined();
    const event = makeEvent("escrow.clawedBack", clawedBack);
    const [intent] = mapping!(event, new EventDataReader(event.data), context);
    expect(intent?.recipientUserId).toBe("buyer1");
    expect(intent?.inApp?.body).toContain("₦9,710.00 is back in your Zudomart wallet");
    expect(intent?.inApp?.body).toContain("Zudomart's escrow fee (₦150.00) and payment processing fee (₦140.00) aren't refunded");
    expect(intent?.email?.(makeRecipient({ accountId: "buyer1" })).props).toMatchObject({ refund: ngn(971_000) });
  });

  it("keeps the plain refund copy when nothing was kept", () => {
    const event = makeEvent("escrow.refunded", { ...clawedBack, status: "refunded", refunded: ngn(1_000_000), refundBreakdown: null, refundDestination: "wallet" });
    const [intent] = eventMappings["escrow.refunded"]!(event, new EventDataReader(event.data), context);
    expect(intent?.inApp?.body).toBe("The money is back in your Zudomart wallet. You can spend it or withdraw it to your bank.");
  });
});
