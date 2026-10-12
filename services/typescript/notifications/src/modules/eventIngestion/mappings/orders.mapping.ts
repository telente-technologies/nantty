import type { SellerItemGroup } from "@zudomart/email-templates";

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
