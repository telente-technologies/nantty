import type { SellerApplication, SellerApplicationInput, SellerDashboardPeriod } from "@/types/account.type";
import type { CatalogProduct, CatalogProductUpsertRequest, StoreLocation } from "@/types/sellerCatalog.type";
import type { MarkOrderShippedInput } from "@/types/commerce.type";
import type { Order, SellerDashboard } from "@/types";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const sellerService = {
  fetchSellerDashboard: (period: SellerDashboardPeriod) =>
    sendRequestToWebappServer<SellerDashboard>("/api/v1/seller/dashboard", { query: { period } }),
  fetchMySellerApplication: () => sendRequestToWebappServer<SellerApplication | null>("/api/v1/seller/applications/me"),
  submitSellerApplication: (input: SellerApplicationInput) =>
    sendRequestToWebappServer<SellerApplication>("/api/v1/seller/applications", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("seller-apply") }),
  listMyStoreProducts: () => sendListRequestToWebappServer<CatalogProduct>("/api/v1/seller/products", { query: { limit: 100 } }),
  fetchStoreProductById: (productId: string) => sendRequestToWebappServer<CatalogProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`),
  listMyStoreLocations: () => sendListRequestToWebappServer<StoreLocation>("/api/v1/seller/locations"),
  createStoreProduct: (input: CatalogProductUpsertRequest, idempotencyKey: string) =>
    sendRequestToWebappServer<CatalogProduct>("/api/v1/seller/products", { method: "POST", body: input, idempotencyKey }),
  updateStoreProduct: (productId: string, input: CatalogProductUpsertRequest) =>
    sendRequestToWebappServer<CatalogProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`, { method: "PATCH", body: input }),
  archiveStoreProduct: (productId: string) =>
    sendRequestToWebappServer<CatalogProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`, { method: "DELETE" }),
  publishStoreProduct: (productId: string) =>
    sendRequestToWebappServer<CatalogProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}/publish`, { method: "POST" }),
  unpublishStoreProduct: (productId: string) =>
    sendRequestToWebappServer<CatalogProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}/unpublish`, { method: "POST" }),
  listMyStoreOrders: () => sendListRequestToWebappServer<Order>("/api/v1/seller/orders"),
  fetchStoreOrderById: (orderId: string) => sendRequestToWebappServer<Order>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}`),
  markStoreOrderAsShipped: async (orderId: string, input: MarkOrderShippedInput, idempotencyKey: string = createIdempotencyKey("ship")) => {
    const locations = await sellerService.listMyStoreLocations();
    const fromLocation = locations.find((location) => location.active && location.isDefault) ?? locations.find((location) => location.active);
    if (!fromLocation) throw new Error("Add a store location in your seller dashboard before shipping.");
    await sendRequestToWebappServer<unknown>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}/fulfilment`, {
      method: "POST",
      body: {
        courier: input.courierName,
        trackingNumber: input.trackingNumber,
        trackingUrl: input.trackingUrl?.trim() || null,
        fromLocationId: fromLocation.id,
      },
      idempotencyKey,
    });
    return sellerService.fetchStoreOrderById(orderId);
  },
  cancelStoreOrder: (orderId: string) =>
    sendRequestToWebappServer<Order>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" }),
};
