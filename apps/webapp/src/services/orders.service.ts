import type { CheckoutResult } from "@/types/commerce.type";
import type { PaymentMode } from "@/types/orders.type";
import { toPaymentModeChoices } from "@/utils/paymentMode.util";
import type { Address, Order, OrderStatus, Page, ReturnRequestInput, ReturnRequestView } from "@/types";

import { sendRequestToWebappServer, sendListRequestToWebappServer } from "./clientApi.service";

export const ordersService = {
  fetchMyShippingAddresses: () => sendListRequestToWebappServer<Address>("/api/v1/users/me/addresses"),
  checkoutCartIntoOrders: (addressId: string, shippingQuoteRevision: string, idempotencyKey: string, paymentModes: Readonly<Record<string, PaymentMode>> = {}) =>
    sendRequestToWebappServer<CheckoutResult>("/api/v1/orders/checkout", {
      method: "POST",
      body: { addressId, shippingQuoteRevision, paymentModes: toPaymentModeChoices(paymentModes), directPaymentAccepted: Object.values(paymentModes).includes("direct") },
      idempotencyKey,
    }),
  fetchMyOrdersPage: (cursor: string | null, status: OrderStatus | null, limit = 20) =>
    sendRequestToWebappServer<Page<Order>>("/api/v1/orders", { query: { status: status ?? undefined, cursor: cursor ?? undefined, limit } }),
  fetchOrderById: (orderId: string) => sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}`),
  fetchMyReturnsPage: (limit = 100, orderId?: string) => sendRequestToWebappServer<Page<ReturnRequestView>>("/api/v1/returns", { query: { limit, orderId } }),
  requestReturn: (orderId: string, input: ReturnRequestInput) =>
    sendRequestToWebappServer<ReturnRequestView>(`/api/v1/orders/${encodeURIComponent(orderId)}/returns`, { method: "POST", body: input }),
  cancelMyOrder: (orderId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}/cancel`, { method: "POST", body: { reason: "Cancelled by buyer" }, idempotencyKey }),
  confirmOrderReceipt: (orderId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}/confirm-receipt`, { method: "POST", idempotencyKey }),
};
