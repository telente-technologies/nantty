import type { CheckoutResult } from "@/types/commerce.type";
import type { Address, Order, OrderStatus, Page, PaymentMode, ReturnRequestInput, ReturnRequestView } from "@/types";

import { api } from "../core/apiClient.service";

export const ordersService = {
  fetchMyShippingAddresses: () => api.getList<Address>("/api/v1/users/me/addresses"),
  checkoutCartIntoOrders: (addressId: string, shippingQuoteRevision: string, idempotencyKey: string, paymentModes: Readonly<Record<string, PaymentMode>> = {}) =>
    api.post<CheckoutResult>(
      "/api/v1/orders/checkout",
      { addressId, shippingQuoteRevision, paymentModes: Object.entries(paymentModes).map(([storeId, paymentMode]) => ({ storeId, paymentMode })), directPaymentAccepted: Object.values(paymentModes).includes("direct") },
      { idempotencyKey },
    ),
  fetchMyOrders: (status: OrderStatus | null) => api.getList<Order>("/api/v1/orders", { status: status ?? undefined }),
  fetchMyOrdersPage: (status: OrderStatus | null, cursor: string | null) =>
    api.get<Page<Order>>("/api/v1/orders", { status: status ?? undefined, cursor: cursor ?? undefined }),
  fetchOrderById: (orderId: string) => api.get<Order>(`/api/v1/orders/${orderId}`),
  fetchMyReturnsPage: (cursor: string | null, limit = 100, orderId?: string) =>
    api.getPage<ReturnRequestView>("/api/v1/returns", { cursor: cursor ?? undefined, limit, orderId }),
  requestReturn: (orderId: string, input: ReturnRequestInput) =>
    api.post<ReturnRequestView>(`/api/v1/orders/${encodeURIComponent(orderId)}/returns`, input),
  confirmOrderReceipt: (orderId: string, idempotencyKey: string) =>
    api.post<Order>(`/api/v1/orders/${orderId}/confirm-receipt`, undefined, { idempotencyKey }),
  cancelOrder: (orderId: string, reason = "Cancelled by buyer") =>
    api.post<Order>(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, { reason }),
};
