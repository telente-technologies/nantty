import { describe, expect, it } from "vitest";

import { eventMappings } from "../src/modules/eventIngestion/mappings/eventMappingRegistry.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeEvent } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };

describe("failed escrow release notification", () => {
  it("notifies the seller that the payout will be retried without exposing provider details", () => {
    const event = makeEvent("escrow.releaseFailed", {
      escrowId: "e1",
      orderId: "o1",
      orderNumber: "ZM-48213",
      sellerUserId: "seller1",
      buyerUserId: "buyer1",
      status: "held",
      autoReleaseAt: "2026-11-03T12:00:00Z",
      reason: "provider account diagnostic",
    });
    const mapping = eventMappings["escrow.releaseFailed"];
    expect(mapping).toBeDefined();
    const [intent] = mapping!(event, new EventDataReader(event.data), context);

    expect(intent?.recipientUserId).toBe("seller1");
    expect(intent?.inApp?.title).toBe("Payout delayed");
    expect(intent?.inApp?.body).toContain("ZM-48213");
    expect(intent?.inApp?.body).toContain("retry automatically");
    expect(intent?.push?.data).toMatchObject({ orderId: "o1" });
    expect(JSON.stringify(intent)).not.toContain("provider account diagnostic");
  });
});

describe("escrow notifications queue coverage", () => {
  it("consumes release scheduling without duplicating the delivered-order notice", () => {
    const event = makeEvent("escrow.releaseScheduled", { escrowId: "e1", orderId: "o1", autoReleaseAt: "2026-11-06T12:00:00Z" });
    const intents = eventMappings[event.type]!(event, new EventDataReader(event.data), context);
    expect(intents).toEqual([]);
  });

  it("notifies both order parties of a neutral payment-status update without provider details", () => {
    const event = makeEvent("escrow.chargeback", {
      escrowId: "e1", orderId: "o1", orderNumber: "ZM-48213", buyerUserId: "buyer1", sellerUserId: "seller1",
      status: "disputed", providerDisputeId: "provider-case-123", reason: "private provider details",
    });
    const intents = eventMappings[event.type]!(event, new EventDataReader(event.data), context);

    expect(intents.map((intent) => intent.recipientUserId)).toEqual(["buyer1", "seller1"]);
    for (const intent of intents) {
      expect(intent.inApp?.title).toBe("Payment status updated");
      expect(intent.inApp?.body).toContain("ZM-48213");
      expect(intent.inApp?.data).toMatchObject({ orderId: "o1", escrowId: "e1" });
    }
    expect(JSON.stringify(intents)).not.toContain("provider-case-123");
    expect(JSON.stringify(intents)).not.toContain("private provider details");
  });
});
