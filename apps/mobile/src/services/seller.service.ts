import type {
  SellerApplication,
  SellerApplicationInput,
  SellerDashboardPeriod,
  StoreProduct,
  StoreProductInput,
} from "@/types/account.type";
import type { Order, SellerDashboard } from "@/types";

import { api } from "./apiClient.service";

export const sellerService = {
  fetchSellerDashboard: (period: SellerDashboardPeriod) => api.get<SellerDashboard>("/api/v1/seller/dashboard", { period }),
  fetchMySellerApplication: () => api.get<SellerApplication | null>("/api/v1/seller/applications/me"),
  submitSellerApplication: (input: SellerApplicationInput) => api.post<SellerApplication>("/api/v1/seller/applications", input),
  listMyStoreProducts: () => api.get<StoreProduct[]>("/api/v1/seller/products"),
  fetchStoreProductById: (productId: string) => api.get<StoreProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`),
  createStoreProduct: (input: StoreProductInput) => api.post<StoreProduct>("/api/v1/seller/products", input),
  updateStoreProduct: (productId: string, input: StoreProductInput) =>
    api.patch<StoreProduct>(`/api/v1/seller/products/${encodeURIComponent(productId)}`, input),
  deleteStoreProduct: (productId: string) => api.delete<void>(`/api/v1/seller/products/${encodeURIComponent(productId)}`),
  listMyStoreOrders: () => api.get<Order[]>("/api/v1/seller/orders"),
  fetchStoreOrderById: (orderId: string) => api.get<Order>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}`),
  markStoreOrderAsShipped: (orderId: string) => api.post<Order>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}/ship`),
};
