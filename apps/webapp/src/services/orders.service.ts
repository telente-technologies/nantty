import type { CheckoutResult } from "@/types/commerce.type";
import type { PaymentMode } from "@/types/orders.type";
import { toPaymentModeChoices } from "@/utils/paymentMode.util";
import type { Address, Order, OrderStatus } from "@/types";

import { sendRequestToWebappServer, sendListRequestToWebappServer } from "./clientApi.service";

export const ordersService = {
  fetchMyShippingAddresses: () => sendListRequestToWebappServer<Address>("/api/v1/users/me/addresses"),
  checkoutCartIntoOrders: (addressId: string, shippingQuoteRevision: string, idempotencyKey: string, paymentModes: Readonly<Record<string, PaymentMode>> = {}) =>
    sendRequestToWebappServer<CheckoutResult>("/api/v1/orders/checkout", {
      method: "POST",
      body: { addressId, shippingQuoteRevision, paymentModes: toPaymentModeChoices(paymentModes), directPaymentAccepted: Object.values(paymentModes).includes("direct") },
      idempotencyKey,
    }),
  fetchMyOrders: (status: OrderStatus | null) => sendListRequestToWebappServer<Order>("/api/v1/orders", { query: { status: status ?? undefined } }),
  fetchOrderById: (orderId: string) => sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}`),
  cancelMyOrder: (orderId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}/cancel`, { method: "POST", body: { reason: "Cancelled by buyer" }, idempotencyKey }),
  confirmOrderReceipt: (orderId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}/confirm-receipt`, { method: "POST", idempotencyKey }),
};
