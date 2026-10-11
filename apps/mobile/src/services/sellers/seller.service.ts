import type {
  SellerApplication,
  SellerApplicationInput,
  SellerDashboardPeriod,
} from "@/types/account.type";
import type { MarkOrderShippedInput } from "@/types/commerce.type";
import type { Order, SellerDashboard } from "@/types";
import type { CatalogProduct, CatalogProductUpsertRequest, StoreLocation } from "@/types/sellerCatalog.type";

import { api } from "../core/apiClient.service";

export const sellerService = {
  fetchSellerDashboard: (period: SellerDashboardPeriod) => api.get<SellerDashboard>("/api/v1/seller/dashboard", { period }),
  fetchMySellerApplication: () => api.get<SellerApplication | null>("/api/v1/seller/applications/me"),
  submitSellerApplication: (input: SellerApplicationInput, idempotencyKey: string) =>
    api.post<SellerApplication>("/api/v1/seller/applications", input, { idempotencyKey }),
  listMyStoreProducts: () => api.getList<CatalogProduct>("/api/v1/seller/products", { limit: 100 }),
  fetchStoreProductById: (productId: string) => api.get<CatalogProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`),
  listMyStoreLocations: () => api.getList<StoreLocation>("/api/v1/seller/locations"),
  createStoreProduct: (input: CatalogProductUpsertRequest, idempotencyKey: string) => api.post<CatalogProduct>("/api/v1/seller/products", input, { idempotencyKey }),
  updateStoreProduct: (productId: string, input: CatalogProductUpsertRequest) =>
    api.patch<CatalogProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`, input),
  archiveStoreProduct: (productId: string) => api.delete<CatalogProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`),
  listMyStoreOrders: () => api.getList<Order>("/api/v1/seller/orders"),
  fetchStoreOrderById: (orderId: string) => api.get<Order>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}`),
  markStoreOrderAsShipped: async (orderId: string, input: MarkOrderShippedInput, idempotencyKey: string) => {
    const locations = await sellerService.listMyStoreLocations();
    const fromLocation = locations.find((location) => location.active && location.isDefault) ?? locations.find((location) => location.active);
    if (!fromLocation) throw new Error("Add a store location in your seller dashboard before shipping.");
    await api.post<unknown>(
      `/api/v1/seller/orders/${encodeURIComponent(orderId)}/fulfilment`,
      { courier: input.courierName, trackingNumber: input.trackingNumber, fromLocationId: fromLocation.id },
      { idempotencyKey },
    );
    return sellerService.fetchStoreOrderById(orderId);
  },
};
