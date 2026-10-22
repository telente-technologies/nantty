import type { SellerItemGroup } from "@zudomart/email-templates";

import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";
import type { NotificationIntent, Recipient } from "../../../types/notification.type.js";
import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { intentFor, orderUrl, plan, readActor, type EventMapping, type MappingContext } from "./mappingHelpers.js";

export function readGroups(data: EventDataReader): { sellerUserId: string; group: SellerItemGroup }[] {
  return data.objectList("groups").map((entry) => {
    entry.objectList("items");
    const { sellerUserId, ...group } = entry.rawValues as Record<string, unknown>;
    return { sellerUserId: String(sellerUserId ?? ""), group: group as unknown as SellerItemGroup };
  });
}

function buyerOrderProps(data: EventDataReader, firstName: string, context: MappingContext) {
  return {
    firstName,
    orderNumber: data.text("orderNumber"),
    orderUrl: orderUrl(context, data.text("orderId")),
    groups: readGroups(data).map((entry) => entry.group),
  };
}

const optionalRefundMethod = (data: EventDataReader) => {
  const refundMethod = data.optionalText("refundMethod");
  return refundMethod === undefined ? {} : { refundMethod };
};
const sellerNameOf = (data: EventDataReader) => data.optionalText("sellerName") ?? readGroups(data)[0]?.group.sellerName ?? data.text("sellerName");

export const orderPlaced: EventMapping = (event, data, context) => [
  intentFor(event, data.text("buyerUserId"), {
    category: "orders",
    inApp: { category: "orders", title: "Order placed", body: `Order ${data.text("orderNumber")} is waiting for payment.`, data: { orderId: data.text("orderId") } },
    email: (recipient) => plan("orderPlaced", { ...buyerOrderProps(data, recipient.firstName, context), payBy: data.text("payBy"), paymentUrl: data.text("paymentUrl") }),
  }),
];

export const orderPaid: EventMapping = (event, data, context) => [
  intentFor(event, data.text("buyerUserId"), {
    category: "orders",
    inApp: { category: "orders", title: "Payment confirmed", body: `Your payment for order ${data.text("orderNumber")} is safe in escrow.`, data: { orderId: data.text("orderId") } },
    push: { title: "Payment confirmed", body: `Order ${data.text("orderNumber")} is paid.`, data: { orderId: data.text("orderId") } },
    email: (recipient) => plan("paymentConfirmed", { ...buyerOrderProps(data, recipient.firstName, context), paymentMethod: data.text("paymentMethod"), paidAt: data.text("paidAt", event.occurredAt) }),
  }),
  ...readGroups(data).map(({ sellerUserId, group }) =>
    intentFor(event, sellerUserId, {
      category: "seller",
      variant: `seller:${sellerUserId}`,
      inApp: { category: "orders", title: "New order — ship within 3 days", body: `${data.optionalText("buyerName") ?? "A buyer"} bought ${group.items[0]?.name ?? "an item"}. Funds are held in escrow.`, actor: readActor(data, "buyer"), data: { orderId: data.text("orderId") } },
      push: { title: "New order", body: `Order ${data.text("orderNumber")} is ready to accept.`, data: { orderId: data.text("orderId") } },
      email: (recipient) => plan("sellerNewOrder", { firstName: recipient.firstName, orderNumber: data.text("orderNumber"), buyerName: data.text("buyerName"), group, acceptBy: data.text("acceptBy"), paymentMode: data.text("paymentMode", "escrow") === "direct" ? "direct" : "escrow" }),
    }),
  ),
];

export const orderSellerAccepted: EventMapping = (event, data, context) => [
  intentFor(event, data.text("buyerUserId"), {
    category: "orders",
    inApp: { category: "orders", title: "Seller accepted your order", body: `${sellerNameOf(data)} is preparing order ${data.text("orderNumber")}.`, data: { orderId: data.text("orderId") } },
    email: (recipient) => plan("sellerAccepted", { ...buyerOrderProps(data, recipient.firstName, context), sellerName: sellerNameOf(data), shipBy: data.text("shipBy") }),
  }),
];

export const orderSellerRejected: EventMapping = (event, data, context) => [
  intentFor(event, data.text("buyerUserId"), {
    category: "orders",
    inApp: { category: "orders", title: "Seller declined your order", body: `${sellerNameOf(data)} could not fulfil order ${data.text("orderNumber")}. You will be refunded.`, data: { orderId: data.text("orderId") } },
    email: (recipient) => plan("sellerRejected", { ...buyerOrderProps(data, recipient.firstName, context), sellerName: sellerNameOf(data), reason: data.text("reason"), refund: data.money("refund"), ...optionalRefundMethod(data) }),
  }),
];

export const orderShipped: EventMapping = (event, data, context) => [
  intentFor(event, data.text("buyerUserId"), {
    category: "orders",
    inApp: { category: "orders", title: "Your order is on its way", body: `${sellerNameOf(data)} shipped order ${data.text("orderNumber")}.`, data: { orderId: data.text("orderId") } },
    push: { title: "Your order is on its way", body: `Order ${data.text("orderNumber")} has shipped.`, data: { orderId: data.text("orderId") } },
    email: (recipient) => plan("orderShipped", { ...buyerOrderProps(data, recipient.firstName, context), sellerName: sellerNameOf(data), carrier: data.text("carrier"), trackingNumber: data.text("trackingNumber"), trackingUrl: data.text("trackingUrl"), estimatedDelivery: data.text("estimatedDelivery") }),
  }),
];

export const orderDelivered: EventMapping = (event, data, context) => [
  intentFor(event, data.text("buyerUserId"), {
    category: "orders",
    inApp: { category: "orders", title: "Delivered — please confirm", body: `Did order ${data.text("orderNumber")} arrive okay? Confirm receipt so the seller gets paid.`, data: { orderId: data.text("orderId") } },
    push: { title: "Delivered — please confirm", body: `Confirm order ${data.text("orderNumber")}.`, data: { orderId: data.text("orderId") } },
    email: (recipient) => plan("orderDelivered", {
      ...buyerOrderProps(data, recipient.firstName, context), sellerName: sellerNameOf(data), deliveredAt: data.text("deliveredAt", event.occurredAt), confirmBy: data.text("confirmBy"),
      confirmUrl: data.text("confirmUrl", `${orderUrl(context, data.text("orderId"))}/confirm`), disputeUrl: data.text("disputeUrl", `${orderUrl(context, data.text("orderId"))}/dispute`),
    }),
  }),
];

export const orderCompleted: EventMapping = (event, data, context) => [
  intentFor(event, data.text("buyerUserId"), {
    category: "orders",
    inApp: { category: "orders", title: "Order completed", body: `Order ${data.text("orderNumber")} is complete. Leave a review?`, data: { orderId: data.text("orderId") } },
    email: (recipient) => plan("orderCompleted", { ...buyerOrderProps(data, recipient.firstName, context), sellerName: sellerNameOf(data), reviewUrl: data.text("reviewUrl", `${orderUrl(context, data.text("orderId"))}/review`) }),
  }),
];

const sellerCancelledBy = (cancelledBy: string) => (cancelledBy === "buyer" || cancelledBy === "you" ? "buyer" : cancelledBy === "seller" ? "system" : "zudomart");
const buyerCancelledBy = (cancelledBy: string) => (cancelledBy === "buyer" || cancelledBy === "you" ? "you" : cancelledBy === "seller" ? "seller" : "zudomart");

export const orderCancelled: EventMapping = (event, data, context) => {
  // Checkout aborts publish a shell `order.cancelled` with only checkoutId/reason/status.
  // It has no buyer or groups, so there is no notification to send.
  if (data.optionalText("buyerUserId") === undefined) return [];
  const cancelledBy = data.text("cancelledBy", "zudomart");
  return [
    intentFor(event, data.text("buyerUserId"), {
      category: "orders",
      inApp: { category: "orders", title: "Order cancelled", body: `Order ${data.text("orderNumber")} was cancelled.`, data: { orderId: data.text("orderId") } },
      email: (recipient) => plan("orderCancelled", { ...buyerOrderProps(data, recipient.firstName, context), cancelledBy: buyerCancelledBy(cancelledBy), reason: data.text("reason"), refund: data.optionalMoney("refund") ?? null, ...optionalRefundMethod(data) }),
    }),
    ...readGroups(data).map(({ sellerUserId, group }) =>
      intentFor(event, sellerUserId, {
        category: "seller",
        variant: `seller:${sellerUserId}`,
        inApp: { category: "orders", title: "Order cancelled", body: `Order ${data.text("orderNumber")} was cancelled.`, data: { orderId: data.text("orderId") } },
        email: (recipient) => plan("sellerOrderCancelled", { firstName: recipient.firstName, orderNumber: data.text("orderNumber"), cancelledBy: sellerCancelledBy(cancelledBy), reason: data.text("reason"), group, restocked: data.bool("restocked", true) }),
      }),
    ),
  ];
};

const orderGroupNumber = (data: EventDataReader): string => data.optionalText("orderNumber") ?? data.optionalText("reference") ?? data.text("orderGroupId");

const orderGroupImage = (item: EventDataReader): string => item.optionalText("imageUrl") ?? "https://placehold.co/112x112/e8e4dc/55504a/png?text=Zudomart";

function readOrderGroup(data: EventDataReader): SellerItemGroup | undefined {
  const rawItems = data.rawValues.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return undefined;
  const items = data.objectList("items").map((item) => {
    const variant = item.optionalText("variant");
    return {
      name: item.text("name"), ...(variant === undefined ? {} : { variant }), quantity: item.integer("quantity"),
      unitPrice: item.money("unitPrice"), imageUrl: orderGroupImage(item),
    };
  });
  return {
    sellerName: data.optionalText("sellerName") ?? "your seller",
    items,
    shipping: { amountMinor: data.integer("shippingMinor"), currency: data.text("currency") },
    ...(data.optionalText("shippingMethod") === undefined ? {} : { shippingMethod: data.optionalText("shippingMethod") }),
    ...(data.optionalText("status") === undefined ? {} : { status: data.optionalText("status") }),
  };
}

function orderGroupEmailProps(data: EventDataReader, context: MappingContext, firstName: string, group: SellerItemGroup) {
  const orderId = data.text("orderGroupId");
  return { firstName, orderNumber: orderGroupNumber(data), orderUrl: orderUrl(context, orderId), groups: [group] };
}

function orderGroupIntent(event: DomainEventEnvelope, recipientUserId: string, title: string, body: string, data: EventDataReader, options: { readonly variant?: string; readonly push?: boolean; readonly extra?: Readonly<Record<string, unknown>> } = {}): NotificationIntent {
  const orderId = data.text("orderGroupId");
  const payload = { orderId, ...options.extra };
  return intentFor(event, recipientUserId, {
    category: "orders",
    ...(options.variant === undefined ? {} : { variant: options.variant }),
    inApp: { category: "orders", title, body, data: payload },
    ...(options.push === true ? { push: { title, body, data: payload } } : {}),
  });
}

export const orderGroupCreated: EventMapping = (event, data, context) => {
  const group = readOrderGroup(data);
  return [
    intentFor(event, data.text("buyerAccountId"), {
      category: "orders",
      inApp: { category: "orders", title: "Order placed", body: `Order ${orderGroupNumber(data)} is waiting for payment.`, data: { orderId: data.text("orderGroupId") } },
      ...(group === undefined ? {} : { email: (recipient: Recipient) => plan("orderPlaced", { ...orderGroupEmailProps(data, context, recipient.firstName, group), payBy: data.text("payBy", event.occurredAt), paymentUrl: orderUrl(context, data.text("orderGroupId")) }) }),
    }),
  ];
};

export const orderGroupPaid: EventMapping = (event, data, context) => {
  const group = readOrderGroup(data);
  return [
    intentFor(event, data.text("buyerAccountId"), {
      category: "orders",
      variant: "buyer",
      inApp: { category: "orders", title: "Payment confirmed", body: `Payment for order ${orderGroupNumber(data)} is confirmed. We'll tell you when the seller accepts it.`, data: { orderId: data.text("orderGroupId") } },
      push: { title: "Payment confirmed", body: `Order ${orderGroupNumber(data)} is paid.`, data: { orderId: data.text("orderGroupId") } },
      ...(group === undefined ? {} : { email: (recipient: Recipient) => plan("paymentConfirmed", { ...orderGroupEmailProps(data, context, recipient.firstName, group), paymentMethod: data.text("paymentMethod", "your payment method"), paidAt: data.text("paidAt", event.occurredAt) }) }),
    }),
    intentFor(event, data.text("sellerAccountId"), {
      category: "seller",
      variant: "seller",
      inApp: { category: "orders", title: "New order", body: `Order ${orderGroupNumber(data)} is paid and waiting for you to accept it.`, data: { orderId: data.text("orderGroupId") } },
      push: { title: "New order", body: `Order ${orderGroupNumber(data)} is ready to accept.`, data: { orderId: data.text("orderGroupId") } },
      ...(group === undefined ? {} : { email: (recipient: Recipient) => plan("sellerNewOrder", {
        firstName: recipient.firstName, orderNumber: orderGroupNumber(data), buyerName: data.optionalText("buyerName") ?? "A buyer", group,
        paymentMode: data.text("paymentMode", "escrow") === "direct" ? "direct" : "escrow",
      }) }),
    }),
  ];
};

export const orderGroupShipped: EventMapping = (event, data, context) => {
  const group = readOrderGroup(data);
  const courier = data.optionalText("courierName");
  const trackingUrl = data.optionalText("trackingUrl");
  const estimatedDelivery = data.optionalText("estimatedDeliveryAt");
  const shippedBody = `Order ${orderGroupNumber(data)} has shipped${courier === undefined ? "" : ` with ${courier}`}.`;
  return [
    intentFor(event, data.text("buyerAccountId"), {
      category: "orders",
      inApp: { category: "orders", title: "Your order is on its way", body: shippedBody, data: { orderId: data.text("orderGroupId"), ...(trackingUrl === undefined ? {} : { trackingUrl }) } },
      push: { title: "Your order is on its way", body: shippedBody, data: { orderId: data.text("orderGroupId") } },
      ...(group === undefined ? {} : { email: (recipient: Recipient) => plan("orderShipped", {
        ...orderGroupEmailProps(data, context, recipient.firstName, group), sellerName: group.sellerName, carrier: courier, trackingNumber: data.optionalText("trackingNumber"),
        trackingUrl, estimatedDelivery,
      }) }),
    }),
  ];
};

export const orderGroupDelivered: EventMapping = (event, data, context) => {
  const group = readOrderGroup(data);
  const deliveredAt = data.text("deliveredAt", event.occurredAt);
  const confirmBy = data.optionalText("confirmBy") ?? new Date(Date.parse(deliveredAt) + 3 * 24 * 60 * 60 * 1000).toISOString();
  return [
    intentFor(event, data.text("buyerAccountId"), {
      category: "orders",
      inApp: { category: "orders", title: "Delivered — please confirm", body: `Confirm order ${orderGroupNumber(data)} so the seller gets paid.`, data: { orderId: data.text("orderGroupId") } },
      push: { title: "Delivered — please confirm", body: `Confirm order ${orderGroupNumber(data)}.`, data: { orderId: data.text("orderGroupId") } },
      ...(group === undefined ? {} : { email: (recipient: Recipient) => plan("orderDelivered", {
        ...orderGroupEmailProps(data, context, recipient.firstName, group), sellerName: group.sellerName,
        deliveredAt, confirmBy,
        confirmUrl: `${orderUrl(context, data.text("orderGroupId"))}/confirm`, disputeUrl: `${orderUrl(context, data.text("orderGroupId"))}/dispute`,
      }) }),
    }),
  ];
};

export const orderGroupCompleted: EventMapping = (event, data, context) => {
  const group = readOrderGroup(data);
  return [
    intentFor(event, data.text("buyerAccountId"), {
      category: "orders",
      inApp: { category: "orders", title: "Order completed", body: `Order ${orderGroupNumber(data)} is complete. Leave a review?`, data: { orderId: data.text("orderGroupId") } },
      ...(group === undefined ? {} : { email: (recipient: Recipient) => plan("orderCompleted", {
        ...orderGroupEmailProps(data, context, recipient.firstName, group), sellerName: group.sellerName,
        reviewUrl: `${orderUrl(context, data.text("orderGroupId"))}/review`,
      }) }),
    }),
  ];
};

export const orderGroupStatusChanged: EventMapping = (event, data) => {
  const to = data.text("to");
  const orderNumber = orderGroupNumber(data);
  if (to === "processing") return [orderGroupIntent(event, data.text("buyerAccountId"), "Seller is preparing your order", `Order ${orderNumber} is being prepared.`, data)];
  if (to === "ready") return [orderGroupIntent(event, data.text("buyerAccountId"), "Your order is ready", `Order ${orderNumber} is ready for delivery.`, data, { push: true })];
  if (to === "cancelled") {
    return [
      orderGroupIntent(event, data.text("buyerAccountId"), "Order cancelled", `Order ${orderNumber} was cancelled.`, data, { variant: "buyer", push: true }),
      orderGroupIntent(event, data.text("sellerAccountId"), "Order cancelled", `Order ${orderNumber} was cancelled.`, data, { variant: "seller", push: true }),
    ];
  }
  return [];
};
