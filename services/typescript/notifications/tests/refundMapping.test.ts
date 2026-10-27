import { describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { escrowPartiallyRefunded, escrowRefunded } from "../src/modules/eventIngestion/mappings/escrowMoney.mapping.js";
import { orderCancelled } from "../src/modules/eventIngestion/mappings/orders.mapping.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { createTestHarness, makeEvent, silentLogger } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };
const refunded = { escrowId: "e1", orderId: "o1", orderNumber: "ZM-48213", buyerUserId: "buyer1", sellerUserId: "seller1", refunded: { amountMinor: 1850000, currency: "NGN" } };

describe("refund notifications say where the money lands", () => {
  it("tells the buyer an escrow refund is back in their Nantty wallet", () => {
    const event = makeEvent("escrow.refunded", { ...refunded, refundDestination: "wallet" });
    const [intent] = escrowRefunded(event, new EventDataReader(event.data), context);
    expect(intent?.inApp?.body).toBe("The money is back in your Nantty wallet. You can spend it or withdraw it to your bank.");
    expect(intent?.push?.body).toBe("It's back in your Nantty wallet.");
    expect(intent?.email?.(makeRecipient({ accountId: "buyer1" })).props).toMatchObject({ refundDestination: "wallet", refundMethod: "Your Nantty wallet" });
  });

  it("tells the buyer a provider refund goes back to how they paid", () => {
    const event = makeEvent("escrow.refunded", { ...refunded, refundDestination: "paymentMethod" });
    const [intent] = escrowRefunded(event, new EventDataReader(event.data), context);
    expect(intent?.inApp?.body).toContain("back to the card or account you paid with");
    expect(intent?.push?.body).toContain("card or account you paid with");
    expect(intent?.email?.(makeRecipient({ accountId: "buyer1" })).props).toMatchObject({ refundDestination: "paymentMethod", refundMethod: "The card or account you paid with" });
  });

  it("treats a partial refund and an event without a destination as a wallet refund", () => {
    for (const data of [{ ...refunded, refundDestination: "wallet" }, refunded]) {
      const event = makeEvent("escrow.partiallyRefunded", data);
      const [intent] = escrowPartiallyRefunded(event, new EventDataReader(event.data), context);
      expect(intent?.inApp?.title).toBe("Partial refund issued");
      expect(intent?.inApp?.body).toContain("Nantty wallet");
      expect(intent?.inApp?.body).not.toContain("original payment method");
    }
  });

  it("does not claim a refund destination on an order cancellation it cannot know yet", () => {
    const event = makeEvent("order.cancelled", { orderId: "o1", orderNumber: "ZM-48213", buyerUserId: "buyer1", groups: [], cancelledBy: "buyer", reason: "Changed my mind", refund: { amountMinor: 1850000, currency: "NGN" } });
    const [intent] = orderCancelled(event, new EventDataReader(event.data), context);
    expect(intent?.email?.(makeRecipient({ accountId: "buyer1" })).props).not.toHaveProperty("refundMethod");
  });

  it("pushes the refund to the buyer's device", async () => {
    const harness = createTestHarness();
    await harness.deviceTokens.register("buyer1", "ExponentPushToken[b1]", "ios");
    const handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger);
    await handler.execute({ event: makeEvent("escrow.refunded", { ...refunded, refundDestination: "wallet" }) });
    expect(harness.pushSender.sent.map((push) => [push.content.title, push.content.body])).toEqual([["Refund issued", "It's back in your Nantty wallet."]]);
  });
});
