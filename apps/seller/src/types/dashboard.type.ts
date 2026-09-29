import type { Money } from "@/types/money.type";
import type { OnlineOrderStatus } from "@/types/order.type";
import type { WalletBalances } from "@/types/wallet.type";

export interface DashboardPeriodSales {
  readonly label: string;
  readonly current: Money;
  readonly previous: Money;
  readonly transactionsCount: number;
}

export interface DashboardDailyRevenuePoint {
  readonly date: string;
  readonly online: Money;
  readonly pos: Money;
}

export interface DashboardTopProduct {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly unitsSold: number;
  readonly revenue: Money;
}

export interface DashboardLowStockAlert {
  readonly variantId: string;
  readonly productId: string;
  readonly productName: string;
  readonly variantTitle: string;
  readonly sku: string;
  readonly locationId: string;
  readonly available: number;
  readonly lowStockThreshold: number;
}

export interface DashboardRecentActivity {
  readonly kind: "pos_sale" | "online_order";
  readonly id: string;
  readonly reference: string;
  readonly customerName: string | null;
  readonly total: Money;
  readonly status: string;
  readonly createdAt: string;
}

export interface DashboardSummary {
  readonly locationId: string | null;
  readonly generatedAt: string;
  readonly salesToday: DashboardPeriodSales;
  readonly salesThisWeek: DashboardPeriodSales;
  readonly salesThisMonth: DashboardPeriodSales;
  readonly ordersByStatus: { readonly status: OnlineOrderStatus; readonly count: number }[];
  readonly channelSplit: { readonly online: Money; readonly pos: Money };
  readonly dailyRevenue: DashboardDailyRevenuePoint[];
  readonly topProducts: DashboardTopProduct[];
  readonly lowStockAlerts: DashboardLowStockAlert[];
  readonly balances: WalletBalances | null;
  readonly recentActivity: DashboardRecentActivity[];
}
