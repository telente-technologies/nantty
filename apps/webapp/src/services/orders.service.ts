import type { CheckoutResult } from "@/types/commerce.type";
import type { Address, Order, OrderStatus } from "@/types";

import { sendRequestToWebappServer, sendListRequestToWebappServer } from "./clientApi.service";

export const ordersService = {
  fetchMyShippingAddresses: () => sendListRequestToWebappServer<Address>("/api/v1/users/me/addresses"),
  checkoutCartIntoOrders: (addressId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<CheckoutResult>("/api/v1/orders/checkout", { method: "POST", body: { addressId }, idempotencyKey }),
  fetchMyOrders: (status: OrderStatus | null) => sendListRequestToWebappServer<Order>("/api/v1/orders", { query: { status: status ?? undefined } }),
  fetchOrderById: (orderId: string) => sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}`),
  confirmOrderReceipt: (orderId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<Order>(`/api/v1/orders/${orderId}/confirm-receipt`, { method: "POST", idempotencyKey }),
};
