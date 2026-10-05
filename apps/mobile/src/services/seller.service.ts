import type {
  SellerApplication,
  SellerApplicationInput,
  SellerDashboardPeriod,
  StoreProduct,
  StoreProductInput,
} from "@/types/account.type";
import type { MarkOrderShippedInput } from "@/types/commerce.type";
import type { Order, SellerDashboard } from "@/types";

import { api } from "./apiClient.service";

interface StoreLocation {
  readonly id: string;
  readonly isDefault: boolean;
  readonly active: boolean;
}

export const sellerService = {
  fetchSellerDashboard: (period: SellerDashboardPeriod) => api.get<SellerDashboard>("/api/v1/seller/dashboard", { period }),
  fetchMySellerApplication: () => api.get<SellerApplication | null>("/api/v1/seller/applications/me"),
  submitSellerApplication: (input: SellerApplicationInput, idempotencyKey: string) =>
    api.post<SellerApplication>("/api/v1/seller/applications", input, { idempotencyKey }),
  listMyStoreProducts: () => api.getList<StoreProduct>("/api/v1/seller/products"),
  fetchStoreProductById: (productId: string) => api.get<StoreProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`),
  createStoreProduct: (input: StoreProductInput) => api.post<StoreProduct>("/api/v1/seller/products", input),
  updateStoreProduct: (productId: string, input: StoreProductInput) =>
    api.patch<StoreProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`, input),
  deleteStoreProduct: (productId: string) => api.delete<void>(`/api/v1/seller/products/${encodeURIComponent(productId)}`),
  listMyStoreOrders: () => api.getList<Order>("/api/v1/seller/orders"),
  fetchStoreOrderById: (orderId: string) => api.get<Order>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}`),
  markStoreOrderAsShipped: async (orderId: string, input: MarkOrderShippedInput, idempotencyKey: string) => {
    const locations = await api.getList<StoreLocation>("/api/v1/seller/locations");
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
