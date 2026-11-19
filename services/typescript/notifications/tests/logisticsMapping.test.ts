import { describe, expect, it } from "vitest";

import {
  partnerAttemptFailed,
  partnerBookingConfirmed,
  partnerBookingFailed,
  partnerInTransit,
} from "../src/modules/eventIngestion/mappings/logistics.mapping.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeEvent } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };

describe("Kwikpik logistics event mappings", () => {
  it("routes booking confirmations through Nantty tracking URLs without leaking courier credentials", () => {
    const data = {
      shipmentId: "ship-1",
      orderGroupId: "og-1",
      orderNumber: "ZM-48213",
      buyerAccountId: "buyer-1",
      sellerAccountId: "seller-1",
      trackingNumber: "KP-992014",
      amountMinor: 350000,
      currency: "NGN",
    };
    const intents = partnerBookingConfirmed(makeEvent("delivery.partnerBookingConfirmed", data), new EventDataReader(data), context);
    expect(intents.map((i) => i.recipientUserId)).toEqual(["buyer-1", "seller-1"]);
    const buyerEmail = intents[0]?.email?.({ firstName: "Amaka", email: "amaka@example.com", userId: "buyer-1" } as never);
    expect(buyerEmail?.templateKey).toBe("deliveryBooked");
    expect((buyerEmail?.props as { trackingUrl: string }).trackingUrl).toBe("https://nantty.com/orders/og-1");
  });

  it("keeps intermediate in-transit updates in-app only and emails on failed attempt", () => {
    const data = { shipmentId: "ship-1", orderGroupId: "og-1", buyerAccountId: "buyer-1" };
    const transit = partnerInTransit(makeEvent("delivery.inTransit", data), new EventDataReader(data), context);
    expect(transit[0]?.email).toBeUndefined();

    const failed = partnerAttemptFailed(makeEvent("delivery.attemptFailed", data), new EventDataReader(data), context);
    expect(failed[0]?.email).toBeDefined();
  });

  it("sends actionable exception email to seller on partner booking failure", () => {
    const data = { shipmentId: "ship-1", orderGroupId: "og-1", sellerAccountId: "seller-1" };
    const [intent] = partnerBookingFailed(makeEvent("delivery.partnerBookingFailed", data), new EventDataReader(data), context);
    expect(intent?.recipientUserId).toBe("seller-1");
    expect(intent?.email).toBeDefined();
  });
});
