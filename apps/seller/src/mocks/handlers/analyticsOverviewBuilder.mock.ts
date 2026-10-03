import { planLimitsByPlan, type SellerPlan } from "@/config/planFeatures.config";
import {
  calculateBasisPointsRatio,
  calculatePlatformFeeMinorForOrder,
  convertIsoToStoreDateKeyForAnalytics,
  countDaysBetweenDateKeysInclusive,
  createStoreMoneyForAnalytics,
  listDateKeysInclusive,
  listOrdersPlacedBetweenDateKeys,
  ordersExcludedFromSales,
  readHourAndWeekdayInStoreTimezone,
  readStoreTrafficForAnalytics,
  shiftDateKeyByDays,
  sumStoreTrafficBetweenDateKeys,
} from "@/mocks/handlers/analyticsRecords.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { AnalyticsComparableTotals, AnalyticsOverview, AnalyticsSeriesBucket, AnalyticsSeriesPoint } from "@/types/analytics.type";
import type { OnlineOrder } from "@/types/order.type";

interface RangeTotals {
  readonly grossMinor: number;
  readonly refundsMinor: number;
  readonly feesMinor: number;
  readonly ordersCount: number;
  readonly refundedOrdersCount: number;
  readonly unitsSold: number;
}

function sumRefundsBetweenDateKeys(fromKey: string, toKey: string): { refundsMinor: number; refundedOrdersCount: number } {
  const { returnRequests, settings } = readMockDatabase();
  const refundedOrders = listOrdersPlacedBetweenDateKeys(fromKey, toKey).filter((order) => order.status === "refunded");
  const refundedReturns = returnRequests.filter((request) => {
    const dateKey = convertIsoToStoreDateKeyForAnalytics(request.createdAt, settings.timezone);
    return request.status === "refunded" && dateKey >= fromKey && dateKey <= toKey;
  });
  return {
    refundsMinor: refundedOrders.reduce((sum, order) => sum + order.total.amountMinor, 0) + refundedReturns.reduce((sum, request) => sum + request.refundAmount.amountMinor, 0),
    refundedOrdersCount: refundedOrders.length + refundedReturns.length,
  };
}

function summariseOrders(orders: readonly OnlineOrder[]): Omit<RangeTotals, "refundsMinor" | "refundedOrdersCount"> {
  const countedOrders = orders.filter((order) => !ordersExcludedFromSales.has(order.status));
  return {
    grossMinor: countedOrders.reduce((sum, order) => sum + order.subtotal.amountMinor, 0),
    feesMinor: countedOrders.reduce((sum, order) => sum + calculatePlatformFeeMinorForOrder(order), 0),
    ordersCount: countedOrders.length,
    unitsSold: countedOrders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.quantity, 0), 0),
  };
}

function summariseRange(fromKey: string, toKey: string): RangeTotals {
  return { ...summariseOrders(listOrdersPlacedBetweenDateKeys(fromKey, toKey)), ...sumRefundsBetweenDateKeys(fromKey, toKey) };
}

function convertRangeTotalsToComparable(totals: RangeTotals, visitors: number): AnalyticsComparableTotals {
  const netMinor = totals.grossMinor - totals.refundsMinor - totals.feesMinor;
  return {
    grossSales: createStoreMoneyForAnalytics(totals.grossMinor),
    netSales: createStoreMoneyForAnalytics(netMinor),
    ordersCount: totals.ordersCount,
    averageOrderValue: createStoreMoneyForAnalytics(totals.ordersCount > 0 ? Math.round(totals.grossMinor / totals.ordersCount) : 0),
    conversionRateBasisPoints: calculateBasisPointsRatio(totals.ordersCount, visitors),
  };
}

function chooseSeriesBucket(daysInRange: number): AnalyticsSeriesBucket {
  if (daysInRange <= 1) return "hour";
  if (daysInRange <= 62) return "day";
  if (daysInRange <= 200) return "week";
  return "month";
}

function readBucketStartForDateKey(dateKey: string, bucket: AnalyticsSeriesBucket): string {
  if (bucket === "month") return `${dateKey.slice(0, 7)}-01`;
  if (bucket === "week") {
    const weekday = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
    return shiftDateKeyByDays(dateKey, -((weekday + 6) % 7));
  }
  return dateKey;
}

function buildHourlySeries(fromKey: string): AnalyticsSeriesPoint[] {
  const { settings } = readMockDatabase();
  const orders = listOrdersPlacedBetweenDateKeys(fromKey, fromKey).filter((order) => !ordersExcludedFromSales.has(order.status));
  const dayViews = readStoreTrafficForAnalytics().dailyTrafficByDateKey.get(fromKey)?.storeViews ?? 0;
  return Array.from({ length: 24 }, (_, hour) => {
    const hourOrders = orders.filter((order) => readHourAndWeekdayInStoreTimezone(order.createdAt, settings.timezone).hour === hour);
    const totals = summariseOrders(hourOrders);
    const daylightShare = hour >= 7 && hour <= 22 ? 1 / 16 : 0;
    return {
      periodStart: `${fromKey}T${String(hour).padStart(2, "0")}:00`,
      grossSales: createStoreMoneyForAnalytics(totals.grossMinor),
      netSales: createStoreMoneyForAnalytics(totals.grossMinor - totals.feesMinor),
      ordersCount: totals.ordersCount,
      storeViews: Math.round(dayViews * daylightShare),
    };
  });
}

function buildBucketedSeries(fromKey: string, toKey: string, bucket: AnalyticsSeriesBucket): AnalyticsSeriesPoint[] {
  if (bucket === "hour") return buildHourlySeries(fromKey);
  const bucketStarts = [...new Set(listDateKeysInclusive(fromKey, toKey).map((dateKey) => readBucketStartForDateKey(dateKey, bucket)))];
  return bucketStarts.map((bucketStart, index) => {
    const nextStart = bucketStarts[index + 1];
    const bucketFrom = bucketStart < fromKey ? fromKey : bucketStart;
    const bucketTo = nextStart ? shiftDateKeyByDays(nextStart, -1) : toKey;
    const totals = summariseRange(bucketFrom, bucketTo);
    return {
      periodStart: bucketFrom,
      grossSales: createStoreMoneyForAnalytics(totals.grossMinor),
      netSales: createStoreMoneyForAnalytics(totals.grossMinor - totals.refundsMinor - totals.feesMinor),
      ordersCount: totals.ordersCount,
      storeViews: sumStoreTrafficBetweenDateKeys(bucketFrom, bucketTo).storeViews,
    };
  });
}

export function clampAnalyticsRangeToPlanHistory(requestedFromKey: string, toKey: string, todayKey: string, plan: SellerPlan): { fromKey: string; historyLimitedToDays: number | null } {
  const historyDays = planLimitsByPlan[plan].analyticsHistoryDays;
  const earliestAllowedKey = shiftDateKeyByDays(todayKey, -(historyDays - 1));
  if (requestedFromKey >= earliestAllowedKey) return { fromKey: requestedFromKey, historyLimitedToDays: null };
  return { fromKey: earliestAllowedKey > toKey ? toKey : earliestAllowedKey, historyLimitedToDays: historyDays };
}

export function buildAnalyticsOverview(requestedFromKey: string, fromKey: string, toKey: string, historyLimitedToDays: number | null): AnalyticsOverview {
  const daysInRange = countDaysBetweenDateKeysInclusive(fromKey, toKey);
  const previousToKey = shiftDateKeyByDays(fromKey, -1);
  const previousFromKey = shiftDateKeyByDays(previousToKey, -(daysInRange - 1));
  const currentTotals = summariseRange(fromKey, toKey);
  const currentTraffic = sumStoreTrafficBetweenDateKeys(fromKey, toKey);
  const previousTraffic = sumStoreTrafficBetweenDateKeys(previousFromKey, previousToKey);
  const bucket = chooseSeriesBucket(daysInRange);
  return {
    from: fromKey,
    to: toKey,
    requestedFrom: requestedFromKey,
    historyLimitedToDays,
    ...convertRangeTotalsToComparable(currentTotals, currentTraffic.visitors),
    refunds: createStoreMoneyForAnalytics(currentTotals.refundsMinor),
    fees: createStoreMoneyForAnalytics(currentTotals.feesMinor),
    refundedOrdersCount: currentTotals.refundedOrdersCount,
    unitsSold: currentTotals.unitsSold,
    storeViews: currentTraffic.storeViews,
    visitors: currentTraffic.visitors,
    previous: convertRangeTotalsToComparable(summariseRange(previousFromKey, previousToKey), previousTraffic.visitors),
    bucket,
    series: buildBucketedSeries(fromKey, toKey, bucket),
  };
}
