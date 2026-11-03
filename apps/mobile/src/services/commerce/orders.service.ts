import type { CheckoutResult } from "@/types/commerce.type";
import type { Address, Order, OrderStatus, Page, PaymentMode } from "@/types";

import { api } from "../core/apiClient.service";

export const ordersService = {
  fetchMyShippingAddresses: () => api.getList<Address>("/api/v1/users/me/addresses"),
  checkoutCartIntoOrders: (addressId: string, idempotencyKey: string, paymentModes: Readonly<Record<string, PaymentMode>> = {}) =>
    api.post<CheckoutResult>(
      "/api/v1/orders/checkout",
      { addressId, paymentModes: Object.entries(paymentModes).map(([storeId, paymentMode]) => ({ storeId, paymentMode })), directPaymentAccepted: Object.values(paymentModes).includes("direct") },
      { idempotencyKey },
    ),
  fetchMyOrders: (status: OrderStatus | null) => api.getList<Order>("/api/v1/orders", { status: status ?? undefined }),
  fetchMyOrdersPage: (status: OrderStatus | null, cursor: string | null) =>
    api.get<Page<Order>>("/api/v1/orders", { status: status ?? undefined, cursor: cursor ?? undefined }),
  fetchOrderById: (orderId: string) => api.get<Order>(`/api/v1/orders/${orderId}`),
  confirmOrderReceipt: (orderId: string, idempotencyKey: string) =>
    api.post<Order>(`/api/v1/orders/${orderId}/confirm-receipt`, undefined, { idempotencyKey }),
};
