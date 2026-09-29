import type { OrderStatus } from "../../../enums/orderStatus.enum.js";
import type { MoneyConversion } from "../../../interfaces/currencyConverter.interface.js";
import { formatScaledRateAsDecimal } from "../../../utils/exchangeRate.util.js";
import { Money } from "../../../utils/money.util.js";
import { convertInternalStatusToPublicStatus, type CheckoutRecord, type OrderRecord } from "../models/orders.model.js";

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

export const keepNativeCurrency: MoneyConversion = (money) => money;

export function convertOrderToDto(order: OrderRecord, shippingPhone: string, convert: MoneyConversion) {
  const { phoneEncrypted: _encrypted, ...address } = order.shippingAddress;
  const inViewCurrency = (amountMinor: number) => convert(Money.of(amountMinor, order.currency)).toDto();
  return {
    id: order.id,
    number: order.number,
    checkoutId: order.checkoutId,
    buyerId: order.buyerId,
    storeId: order.storeId,
    status: convertInternalStatusToPublicStatus(order.status),
    refunded: order.status === "refunded",
    displayStatus: DISPLAY_STATUS[order.status],
    storeCurrency: order.currency,
    itemsTotal: inViewCurrency(order.itemsTotal),
    discountTotal: inViewCurrency(order.discountTotal),
    shippingTotal: inViewCurrency(order.shippingTotal),
    total: inViewCurrency(order.total),
    charged: {
      total: Money.of(order.chargeTotal, order.chargeCurrency).toDto(),
      exchangeRate: formatScaledRateAsDecimal(order.exchangeRate),
      rateLockedAt: order.rateLockedAt.toISOString(),
    },
    customerName: order.customerName,
    shippingAddress: { ...address, phone: shippingPhone },
    trackingNumber: order.trackingNumber,
    items: order.items.map(({ orderId: _orderId, unitPrice, lineTotal, ...item }) => ({ ...item, unitPrice: inViewCurrency(unitPrice), lineTotal: inViewCurrency(lineTotal) })),
    paidAt: convertDateToText(order.paidAt),
    shippedAt: convertDateToText(order.shippedAt),
    deliveredAt: convertDateToText(order.deliveredAt),
    completedAt: convertDateToText(order.completedAt),
    cancelledAt: convertDateToText(order.cancelledAt),
    createdAt: order.createdAt.toISOString(),
  };
}

export function convertCheckoutToDto(checkout: CheckoutRecord) {
  return { id: checkout.id, total: Money.of(checkout.total, checkout.currency).toDto(), status: checkout.status, createdAt: checkout.createdAt.toISOString() };
}
