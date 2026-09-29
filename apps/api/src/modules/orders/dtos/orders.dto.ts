import type { OrderStatus } from "../../../enums/orderStatus.enum.js";
import type { CheckoutRecord, OrderRecord } from "../models/orders.model.js";

const DISPLAY_STATUS: Readonly<Record<OrderStatus, string>> = {
  pending_payment: "Awaiting payment",
  paid: "Pending",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Delivered",
  disputed: "Disputed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function convertDateToText(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export function convertOrderToDto(order: OrderRecord, shippingPhone: string) {
  const { phoneEncrypted: _encrypted, ...address } = order.shippingAddress;
  return {
    id: order.id,
    number: order.number,
    checkoutId: order.checkoutId,
    buyerId: order.buyerId,
    storeId: order.storeId,
    status: order.status,
    displayStatus: DISPLAY_STATUS[order.status],
    currency: order.currency,
    itemsTotal: order.itemsTotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    total: order.total,
    shippingAddress: { ...address, phone: shippingPhone },
    trackingNumber: order.trackingNumber,
    items: order.items.map(({ orderId: _orderId, ...item }) => item),
    paidAt: convertDateToText(order.paidAt),
    shippedAt: convertDateToText(order.shippedAt),
    deliveredAt: convertDateToText(order.deliveredAt),
    completedAt: convertDateToText(order.completedAt),
    cancelledAt: convertDateToText(order.cancelledAt),
    createdAt: order.createdAt.toISOString(),
  };
}

export function convertCheckoutToDto(checkout: CheckoutRecord) {
  return { id: checkout.id, total: checkout.total, currency: checkout.currency, status: checkout.status, createdAt: checkout.createdAt.toISOString() };
}
