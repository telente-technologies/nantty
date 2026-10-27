import { describe, expect, it } from "vitest";

import { eventMappings } from "../src/modules/eventIngestion/mappings/eventMappingRegistry.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeEvent } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };
const underReview = { escrowId: "e1", orderId: "o1", orderNumber: "ZM-48213", buyerUserId: "buyer1", sellerUserId: "seller1", status: "held", amount: { amountMinor: 1850000, currency: "NGN" } };

describe("undelivered order under staff review", () => {
  it("tells both the buyer and the seller that staff will review and contact them", () => {
    const mapping = eventMappings["escrow.underReview"];
    expect(mapping).toBeDefined();
    const event = makeEvent("escrow.underReview", underReview);
    const intents = mapping!(event, new EventDataReader(event.data), context);
    expect(intents.map((intent) => intent.recipientUserId)).toEqual(["buyer1", "seller1"]);
    for (const intent of intents) {
      expect(intent.inApp?.title).toBe("Order under review");
      expect(intent.inApp?.body).toContain("ZM-48213");
      expect(intent.inApp?.body).toContain("Nantty staff");
      expect(intent.push?.title).toBe("Order under review");
      expect(intent.inApp?.data).toMatchObject({ orderId: "o1", escrowId: "e1" });
    }
    expect(intents[0]!.inApp?.body).toContain("Your payment stays safe");
    expect(intents[1]!.inApp?.body).toContain("proof of delivery");
  });
});
