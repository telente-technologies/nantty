import type { Money } from "@/types/money.type";

export type AnalyticsSeriesBucket = "hour" | "day" | "week" | "month";

export interface AnalyticsSeriesPoint {
  readonly periodStart: string;
  readonly grossSales: Money;
  readonly netSales: Money;
  readonly ordersCount: number;
  readonly storeViews: number;
}

export interface SellerFunnelSummary {
  readonly storeId: string;
  readonly window: string;
  readonly productViews: number;
  readonly addToCarts: number;
  readonly orders: number;
  readonly grossSalesMinor: number;
  readonly conversionRate: number;
}

export interface AnalyticsComparableTotals {
  readonly grossSales: Money;
  readonly netSales: Money;
  readonly ordersCount: number;
  readonly averageOrderValue: Money;
  readonly conversionRateBasisPoints: number;
}

export interface AnalyticsOverview extends AnalyticsComparableTotals {
  readonly from: string;
  readonly to: string;
  readonly requestedFrom: string;
  readonly historyLimitedToDays: number | null;
  readonly refunds: Money;
  readonly fees: Money;
  readonly refundedOrdersCount: number;
  readonly unitsSold: number;
  readonly storeViews: number;
  readonly visitors: number;
  readonly previous: AnalyticsComparableTotals;
  readonly bucket: AnalyticsSeriesBucket;
  readonly series: AnalyticsSeriesPoint[];
}

export interface AnalyticsProductPerformance {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly categoryName: string;
  readonly unitsSold: number;
  readonly revenue: Money;
  readonly productViews: number;
  readonly conversionRateBasisPoints: number;
  readonly stockAvailable: number;
  readonly lastSoldAt: string | null;
}

export interface AnalyticsSegmentRow {
  readonly key: string;
  readonly label: string;
  readonly ordersCount: number;
  readonly unitsSold: number;
  readonly revenue: Money;
  readonly shareBasisPoints: number;
}

export interface AnalyticsTimeSlotRow {
  readonly slot: number;
  readonly ordersCount: number;
  readonly revenue: Money;
}

export interface AnalyticsRefundRow {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly customerName: string;
  readonly amount: Money;
  readonly reason: string;
  readonly refundedAt: string;
}

export interface AnalyticsBreakdowns {
  readonly from: string;
  readonly to: string;
  readonly bestProducts: AnalyticsProductPerformance[];
  readonly slowProducts: AnalyticsProductPerformance[];
  readonly byCategory: AnalyticsSegmentRow[];
  readonly byState: AnalyticsSegmentRow[];
  readonly byCity: AnalyticsSegmentRow[];
  readonly byHourOfDay: AnalyticsTimeSlotRow[];
  readonly byWeekday: AnalyticsTimeSlotRow[];
  readonly refunds: AnalyticsRefundRow[];
}
