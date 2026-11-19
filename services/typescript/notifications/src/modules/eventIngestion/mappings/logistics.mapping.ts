import { intentFor, orderUrl, plan, sellerOrderUrl, type EventMapping, type MappingContext } from "./mappingHelpers.js";
import type { EventDataReader } from "../../../utils/eventDataReader.util.js";

const serviceName = "Nantty Partner (Kwikpik)";

function buildLogisticsProps(data: EventDataReader, firstName: string, url: string) {
  const trackingNumber = data.optionalText("trackingNumber");
  const estimatedDelivery = data.optionalText("estimatedDeliveryAt");
  const amountMinor = data.rawValues.amountMinor;
  const currency = data.optionalText("currency");
  return {
    firstName,
    orderNumber: data.optionalText("orderNumber") ?? data.text("orderGroupId"),
    trackingUrl: url,
    serviceName,
    ...(trackingNumber ? { trackingNumber } : {}),
    ...(estimatedDelivery ? { estimatedDelivery } : {}),
    ...(typeof amountMinor === "number" && currency ? { fee: { amountMinor, currency } } : {}),
  };
}

export const partnerBookingConfirmed: EventMapping = (event, data, context: MappingContext) => {
  const orderGroupId = data.text("orderGroupId");
  const buyerId = data.optionalText("buyerAccountId");
  const sellerId = data.optionalText("sellerAccountId");
  const intents = [];
  if (buyerId) {
    intents.push(
      intentFor(event, buyerId, {
        category: "orders",
        variant: "buyer",
        inApp: { category: "orders", title: "Courier pickup scheduled", body: `Partner delivery is booked for order ${orderGroupId}.`, data: { orderId: orderGroupId } },
        push: { title: "Courier pickup scheduled", body: `Your order delivery is scheduled with ${serviceName}.`, data: { orderId: orderGroupId } },
        email: (recipient) => plan("deliveryBooked", buildLogisticsProps(data, recipient.firstName, orderUrl(context, orderGroupId))),
      }),
    );
  }
  if (sellerId) {
    intents.push(
      intentFor(event, sellerId, {
        category: "seller",
        variant: "seller",
        inApp: { category: "orders", title: "Partner courier confirmed", body: `Courier booking confirmed for order ${orderGroupId}.`, data: { orderId: orderGroupId } },
        email: (recipient) => plan("deliveryBooked", buildLogisticsProps(data, recipient.firstName, sellerOrderUrl(context, orderGroupId))),
      }),
    );
  }
  return intents;
};

export const partnerBookingFailed: EventMapping = (event, data, context: MappingContext) => {
  const orderGroupId = data.text("orderGroupId");
  const sellerId = data.optionalText("sellerAccountId");
  if (!sellerId) return [];
  return [
    intentFor(event, sellerId, {
      category: "seller",
      inApp: { category: "orders", title: "Partner booking failed", body: `Partner delivery booking for order ${orderGroupId} could not be confirmed.`, data: { orderId: orderGroupId } },
      email: (recipient) =>
        plan("deliveryException", {
          ...buildLogisticsProps(data, recipient.firstName, sellerOrderUrl(context, orderGroupId)),
          actionRequired: "Review pickup details and request a new courier quote in Nantty.",
        }),
    }),
  ];
};

export const partnerPickedUp: EventMapping = (event, data, context: MappingContext) => {
  const orderGroupId = data.text("orderGroupId");
  const buyerId = data.optionalText("buyerAccountId");
  if (!buyerId) return [];
  return [
    intentFor(event, buyerId, {
      category: "orders",
      inApp: { category: "orders", title: "Order picked up", body: `${serviceName} collected your order.`, data: { orderId: orderGroupId } },
      push: { title: "Order picked up", body: `${serviceName} is on the way with your order.`, data: { orderId: orderGroupId } },
      email: (recipient) => plan("deliveryPickedUp", buildLogisticsProps(data, recipient.firstName, orderUrl(context, orderGroupId))),
    }),
  ];
};

export const partnerInTransit: EventMapping = (event, data) => {
  const orderGroupId = data.text("orderGroupId");
  const buyerId = data.optionalText("buyerAccountId");
  if (!buyerId) return [];
  return [
    intentFor(event, buyerId, {
      category: "orders",
      inApp: { category: "orders", title: "Order in transit", body: `Your order is moving with ${serviceName}.`, data: { orderId: orderGroupId } },
    }),
  ];
};

export const partnerAttemptFailed: EventMapping = (event, data, context: MappingContext) => {
  const orderGroupId = data.text("orderGroupId");
  const buyerId = data.optionalText("buyerAccountId");
  if (!buyerId) return [];
  return [
    intentFor(event, buyerId, {
      category: "orders",
      inApp: { category: "orders", title: "Delivery attempt missed", body: `${serviceName} could not complete delivery.`, data: { orderId: orderGroupId } },
      push: { title: "Delivery attempt missed", body: "Check your order in Nantty for redelivery details.", data: { orderId: orderGroupId } },
      email: (recipient) => plan("deliveryAttemptFailed", buildLogisticsProps(data, recipient.firstName, orderUrl(context, orderGroupId))),
    }),
  ];
};

export const partnerDelivered: EventMapping = (event, data, context: MappingContext) => {
  const orderGroupId = data.text("orderGroupId");
  const buyerId = data.optionalText("buyerAccountId");
  if (!buyerId) return [];
  return [
    intentFor(event, buyerId, {
      category: "orders",
      inApp: { category: "orders", title: "Order delivered", body: `${serviceName} marked your order as delivered.`, data: { orderId: orderGroupId } },
      push: { title: "Order delivered", body: "Confirm delivery inside Nantty.", data: { orderId: orderGroupId } },
      email: (recipient) => plan("deliveryDelivered", buildLogisticsProps(data, recipient.firstName, orderUrl(context, orderGroupId))),
    }),
  ];
};

export const partnerCancelled: EventMapping = (event, data, context: MappingContext) => {
  const orderGroupId = data.text("orderGroupId");
  const buyerId = data.optionalText("buyerAccountId");
  if (!buyerId) return [];
  return [
    intentFor(event, buyerId, {
      category: "orders",
      inApp: { category: "orders", title: "Partner delivery cancelled", body: `The courier booking for order ${orderGroupId} was cancelled.`, data: { orderId: orderGroupId } },
      email: (recipient) => plan("deliveryCancelled", buildLogisticsProps(data, recipient.firstName, orderUrl(context, orderGroupId))),
    }),
  ];
};
