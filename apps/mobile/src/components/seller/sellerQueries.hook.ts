import { useQuery } from "@tanstack/react-query";

import { sellerService } from "@/services/sellers/seller.service";
import type { SellerDashboardPeriod } from "@/types/account.type";

export const sellerQueryKeys = {
  dashboard: (period: SellerDashboardPeriod) => ["seller", "dashboard", period] as const,
  products: ["seller", "products"] as const,
  product: (productId: string) => ["seller", "products", productId] as const,
  orders: ["seller", "orders"] as const,
  order: (orderId: string) => ["seller", "orders", orderId] as const,
  application: ["seller", "application"] as const,
};

export function useSellerDashboardQuery(period: SellerDashboardPeriod) {
  return useQuery({ queryKey: sellerQueryKeys.dashboard(period), queryFn: () => sellerService.fetchSellerDashboard(period) });
}
