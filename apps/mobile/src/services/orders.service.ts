import type { CheckoutResult, DisputeReason } from "@/types/commerce.type";
import type { Address, Order, OrderStatus } from "@/types";

import { api } from "./api-client.service";

export const ordersService = {
  fetchMyShippingAddresses: () => api.get<Address[]>("/api/v1/users/me/addresses"),
  checkoutCartIntoOrders: (addressId: string, idempotencyKey: string) =>
    api.post<CheckoutResult>("/api/v1/orders/checkout", { addressId }, { idempotencyKey }),
  fetchMyOrders: (status: OrderStatus | null) => api.get<Order[]>("/api/v1/orders", { status: status ?? undefined }),
  fetchOrderById: (orderId: string) => api.get<Order>(`/api/v1/orders/${orderId}`),
  confirmOrderReceipt: (orderId: string, idempotencyKey: string) =>
    api.post<Order>(`/api/v1/orders/${orderId}/confirm-receipt`, undefined, { idempotencyKey }),
  openOrderDispute: (orderId: string, reason: DisputeReason, details: string, idempotencyKey: string) =>
    api.post<Order>(`/api/v1/orders/${orderId}/disputes`, { reason, details }, { idempotencyKey }),
};
