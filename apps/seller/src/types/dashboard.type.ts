import type { Money } from "@/types/money.type";
import type { OnlineOrderStatus } from "@/types/order.type";
import type { WalletBalances } from "@/types/wallet.type";

export interface DashboardPeriodSales {
  readonly label: string;
  readonly current: Money;
  readonly previous: Money;
  readonly ordersCount: number;
}

export interface DashboardDailyRevenuePoint {
  readonly date: string;
  readonly revenue: Money;
  readonly ordersCount: number;
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

export interface DashboardRecentOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly customerName: string;
  readonly customerUsername: string;
  readonly itemsCount: number;
  readonly total: Money;
  readonly status: OnlineOrderStatus;
  readonly createdAt: string;
}

export type DashboardActivityKind = "order_placed" | "order_shipped" | "order_delivered" | "dispute_opened" | "return_requested" | "team_action";

export interface DashboardActivityEntry {
  readonly id: string;
  readonly kind: DashboardActivityKind;
  readonly summary: string;
  readonly actorName: string | null;
  readonly href: string | null;
  readonly createdAt: string;
}

export type DashboardAlertKind = "orders_to_accept" | "disputes_awaiting_response" | "returns_requested" | "out_of_stock" | "low_stock" | "unanswered_messages";

export interface DashboardAlert {
  readonly kind: DashboardAlertKind;
  readonly severity: "info" | "caution" | "error";
  readonly count: number;
  readonly title: string;
  readonly description: string;
  readonly href: string;
}

export interface DashboardTrafficSummary {
  readonly storeViews: number;
  readonly previousStoreViews: number;
  readonly visitors: number;
  readonly conversionRateBasisPoints: number;
  readonly previousConversionRateBasisPoints: number;
  readonly dailyStoreViews: number[];
}

export interface DashboardCustomerGrowth {
  readonly totalCustomers: number;
  readonly newCustomers: number;
  readonly previousNewCustomers: number;
  readonly returningCustomers: number;
  readonly dailyNewCustomers: number[];
}

export interface DashboardCatalogSummary {
  readonly totalProducts: number;
  readonly activeProducts: number;
  readonly draftProducts: number;
  readonly lowStockCount: number;
  readonly outOfStockCount: number;
}

export interface DashboardSummary {
  readonly locationId: string | null;
  readonly generatedAt: string;
  readonly salesToday: DashboardPeriodSales;
  readonly salesThisWeek: DashboardPeriodSales;
  readonly salesThisMonth: DashboardPeriodSales;
  readonly lifetimeSales: { readonly total: Money; readonly ordersCount: number };
  readonly ordersByStatus: { readonly status: OnlineOrderStatus; readonly count: number }[];
  readonly dailyRevenue: DashboardDailyRevenuePoint[];
  readonly topProducts: DashboardTopProduct[];
  readonly lowStockAlerts: DashboardLowStockAlert[];
  readonly catalog: DashboardCatalogSummary;
  readonly traffic: DashboardTrafficSummary;
  readonly customerGrowth: DashboardCustomerGrowth;
  readonly balances: WalletBalances | null;
  readonly recentOrders: DashboardRecentOrder[];
  readonly activity: DashboardActivityEntry[];
  readonly alerts: DashboardAlert[];
}
