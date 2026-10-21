import { describe, expect, it } from "vitest";

import { orderGroupShipped, orderGroupStatusChanged, orderCancelled } from "../src/modules/eventIngestion/mappings/orders.mapping.js";
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

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };
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

  it("keeps the tracking link on the shipped notification", () => {
    const data = { ...orderGroup, occurredAt: "2026-10-06T10:00:00.000Z", courierName: "GIG", trackingNumber: "GIG123", trackingUrl: "https://track.example/GIG123" };
    const [intent] = orderGroupShipped(makeEvent("orderGroup.shipped", data), new EventDataReader(data), context);
    expect(intent?.inApp).toMatchObject({ title: "Your order is on its way", data: { orderId: "og1", trackingUrl: "https://track.example/GIG123" } });
    expect(intent?.push).toMatchObject({ body: "Order ZM-48213 has shipped with GIG." });
  });

  it("ignores the checkout shell order.cancelled event", () => {
    const data = { checkoutId: "c1", reason: "Payment abandoned", status: "cancelled" };
    expect(orderCancelled(makeEvent("order.cancelled", data), new EventDataReader(data), context)).toEqual([]);
  });
});
