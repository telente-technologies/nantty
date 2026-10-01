import type { CheckoutResult } from "@/types/commerce.type";
import type { Address, Order, OrderStatus } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export const ordersService = {
  fetchMyShippingAddresses: () => sendRequestToWebappServer<Address[]>("/api/v1/users/me/addresses"),
  checkoutCartIntoOrders: (addressId: string, idempotencyKey: string, redeemLoyaltyPoints = false) =>
    sendRequestToWebappServer<CheckoutResult>("/api/v1/orders/checkout", { method: "POST", body: { addressId, redeemLoyaltyPoints }, idempotencyKey }),
  fetchMyOrders: (status: OrderStatus | null) => sendRequestToWebappServer<Order[]>("/api/v1/orders", { query: { status: status ?? undefined } }),
  fetchOrderById: (orderId: string) => sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}`),
  confirmOrderReceipt: (orderId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}/confirm-receipt`, { method: "POST", idempotencyKey }),
};
