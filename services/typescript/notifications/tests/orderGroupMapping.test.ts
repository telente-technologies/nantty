import { describe, expect, it } from "vitest";

import { orderGroupDeliveryAttemptFailed, orderGroupShipped, orderGroupStatusChanged, orderCancelled } from "../src/modules/eventIngestion/mappings/orders.mapping.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeEvent } from "./fakes/testHarness.fake.js";

const orderGroup = {
  orderGroupId: "og1",
  orderNumber: "ZM-48213",
  checkoutId: "c1",
  storeId: "s1",
  buyerAccountId: "buyer1",
  sellerAccountId: "seller1",
  subtotalMinor: 1_700_000,
  totalMinor: 1_850_000,
  refundedMinor: 0,
  currency: "NGN",
};

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };
const statusChanged = (to: string) =>
  orderGroupStatusChanged(
    makeEvent("orderGroup.statusChanged", { ...orderGroup, reference: orderGroup.orderNumber, from: "new", to, actorKind: "seller" }),
    new EventDataReader({ ...orderGroup, reference: orderGroup.orderNumber, from: "new", to, actorKind: "seller" }),
    context,
  );

describe("orderGroup notifications", () => {
  it("maps preparation status to the buyer only", () => {
    const intents = statusChanged("processing");
    expect(intents.map((intent) => intent.recipientUserId)).toEqual(["buyer1"]);
    expect(intents[0]?.inApp).toMatchObject({ title: "Seller is preparing your order", data: { orderId: "og1" } });
  });

  it("notifies both sides when an order is cancelled", () => {
    const intents = statusChanged("cancelled");
    expect(intents.map((intent) => `${intent.recipientUserId}:${intent.variant}`)).toEqual(["buyer1:buyer", "seller1:seller"]);
  });

  it("does not duplicate shipped or delivered with the status change", () => {
    expect(statusChanged("shipped")).toEqual([]);
    expect(statusChanged("delivered")).toEqual([]);
  });

  it("routes shipment tracking through the Nantty order page instead of the courier URL", () => {
    const data = { ...orderGroup, shippingMinor: 0, items: [{ name: "Synthetic item", quantity: 1, unitPrice: { amountMinor: 1200, currency: "NGN" } }], occurredAt: "2026-10-06T10:00:00.000Z", courierName: "GIG", trackingNumber: "GIG123", trackingUrl: "https://track.example/GIG123" };
    const [intent] = orderGroupShipped(makeEvent("orderGroup.shipped", data), new EventDataReader(data), context);
    expect(intent?.inApp).toMatchObject({ title: "Your order is on its way", data: { orderId: "og1" } });
    expect(intent?.inApp?.data).not.toHaveProperty("trackingUrl");
    expect(intent?.push).toMatchObject({ body: "Order ZM-48213 has shipped with GIG." });
    const emailPlan = intent?.email?.({ accountId: "buyer1", email: "buyer@example.ng", emailVerified: true, firstName: "Ada", username: "ada", marketingConsent: false, status: "active" });
    expect(emailPlan?.templateKey).toBe("orderShipped");
    expect(emailPlan?.props).toMatchObject({ orderUrl: "https://nantty.com/orders/og1", trackingNumber: "GIG123" });
    expect(emailPlan?.props).not.toHaveProperty("trackingUrl");
    expect(JSON.stringify(emailPlan?.props)).not.toContain("track.example");
  });

  it("notifies only the buyer about a failed delivery attempt without forwarding seller notes", () => {
    const data = { ...orderGroup, reference: "ZM-48213", attempts: 2, actorKind: "seller", note: "Private address details" };
    const [intent] = orderGroupDeliveryAttemptFailed(makeEvent("orderGroup.deliveryAttemptFailed", data), new EventDataReader(data), context);

    expect(intent?.recipientUserId).toBe("buyer1");
    expect(intent?.inApp).toMatchObject({
      category: "orders",
      title: "Delivery attempt unsuccessful",
      body: "A delivery attempt for order ZM-48213 was unsuccessful. Check your order for the latest update.",
      data: { orderId: "og1", deliveryAttempts: 2 },
    });
    expect(intent?.push?.body).toBe(intent?.inApp?.body);
    expect(JSON.stringify(intent)).not.toContain("Private address details");
    expect(intent?.email).toBeUndefined();
  });

  it("ignores the checkout shell order.cancelled event", () => {
    const data = { checkoutId: "c1", reason: "Payment abandoned", status: "cancelled" };
    expect(orderCancelled(makeEvent("order.cancelled", data), new EventDataReader(data), context)).toEqual([]);
  });
});
