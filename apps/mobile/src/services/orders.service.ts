import type { CheckoutResult } from "@/types/commerce.type";
import type { Address, Order, OrderStatus } from "@/types";

import { api } from "./apiClient.service";

export const ordersService = {
  fetchMyShippingAddresses: () => api.getList<Address>("/api/v1/users/me/addresses"),
  checkoutCartIntoOrders: (addressId: string, idempotencyKey: string) =>
    api.post<CheckoutResult>("/api/v1/orders/checkout", { addressId }, { idempotencyKey }),
  fetchMyOrders: (status: OrderStatus | null) => api.getList<Order>("/api/v1/orders", { status: status ?? undefined }),
  fetchOrderById: (orderId: string) => api.get<Order>(`/api/v1/orders/${orderId}`),
  confirmOrderReceipt: (orderId: string, idempotencyKey: string) =>
    api.post<Order>(`/api/v1/orders/${orderId}/confirm-receipt`, undefined, { idempotencyKey }),
};
