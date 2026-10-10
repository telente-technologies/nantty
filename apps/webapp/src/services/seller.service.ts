import type { SellerApplication, SellerApplicationInput, SellerDashboardPeriod, StoreProduct, StoreProductInput } from "@/types/account.type";
import type { MarkOrderShippedInput } from "@/types/commerce.type";
import type { Order, SellerDashboard } from "@/types";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const sellerService = {
  fetchSellerDashboard: (period: SellerDashboardPeriod) =>
    sendRequestToWebappServer<SellerDashboard>("/api/v1/seller/dashboard", { query: { period } }),
  fetchMySellerApplication: () => sendRequestToWebappServer<SellerApplication | null>("/api/v1/seller/applications/me"),
  submitSellerApplication: (input: SellerApplicationInput) =>
    sendRequestToWebappServer<SellerApplication>("/api/v1/seller/applications", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("seller-apply") }),
  listMyStoreProducts: () => sendListRequestToWebappServer<StoreProduct>("/api/v1/seller/products"),
  fetchStoreProductById: (productId: string) => sendRequestToWebappServer<StoreProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`),
  createStoreProduct: (input: StoreProductInput) =>
    sendRequestToWebappServer<StoreProduct>("/api/v1/seller/products", { method: "POST", body: input }),
  updateStoreProduct: (productId: string, input: StoreProductInput) =>
    sendRequestToWebappServer<StoreProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`, { method: "PATCH", body: input }),
  deleteStoreProduct: (productId: string) =>
    sendRequestToWebappServer<void>(`/api/v1/seller/products/${encodeURIComponent(productId)}`, { method: "DELETE" }),
  publishStoreProduct: (productId: string) =>
    sendRequestToWebappServer<StoreProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}/publish`, { method: "POST" }),
  unpublishStoreProduct: (productId: string) =>
    sendRequestToWebappServer<StoreProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}/unpublish`, { method: "POST" }),
  listMyStoreOrders: () => sendListRequestToWebappServer<Order>("/api/v1/seller/orders"),
  fetchStoreOrderById: (orderId: string) => sendRequestToWebappServer<Order>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}`),
  markStoreOrderAsShipped: (orderId: string, input: MarkOrderShippedInput) =>
    sendRequestToWebappServer<Order>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}/fulfilment`, { method: "POST", body: input, idempotencyKey: createIdempotencyKey("ship") }),
  cancelStoreOrder: (orderId: string) =>
    sendRequestToWebappServer<Order>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" }),
};
