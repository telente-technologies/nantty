import {
  calculateBasisPointsRatio,
  convertIsoToStoreDateKeyForAnalytics,
  createStoreMoneyForAnalytics,
  listOrdersPlacedBetweenDateKeys,
  ordersExcludedFromSales,
  readHourAndWeekdayInStoreTimezone,
  readStoreTrafficForAnalytics,
  sumStoreTrafficBetweenDateKeys,
} from "@/mocks/handlers/analyticsRecords.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { AnalyticsBreakdowns, AnalyticsProductPerformance, AnalyticsRefundRow, AnalyticsSegmentRow, AnalyticsTimeSlotRow } from "@/types/analytics.type";
import type { OnlineOrder } from "@/types/order.type";

interface SegmentAccumulator {
  label: string;
  orderIds: Set<string>;
  unitsSold: number;
  revenueMinor: number;
}

function accumulateSegment(segments: Map<string, SegmentAccumulator>, key: string, label: string, orderId: string, quantity: number, revenueMinor: number): void {
  const segment = segments.get(key) ?? { label, orderIds: new Set<string>(), unitsSold: 0, revenueMinor: 0 };
  segment.orderIds.add(orderId);
  segment.unitsSold += quantity;
  segment.revenueMinor += revenueMinor;
  segments.set(key, segment);
}

function convertSegmentsToRows(segments: Map<string, SegmentAccumulator>, limit: number): AnalyticsSegmentRow[] {
  const totalRevenueMinor = [...segments.values()].reduce((sum, segment) => sum + segment.revenueMinor, 0);
  return [...segments.entries()]
    .map(([key, segment]) => ({ key, label: segment.label, ordersCount: segment.orderIds.size, unitsSold: segment.unitsSold, revenue: createStoreMoneyForAnalytics(segment.revenueMinor), shareBasisPoints: calculateBasisPointsRatio(segment.revenueMinor, totalRevenueMinor) }))
    .sort((first, second) => second.revenue.amountMinor - first.revenue.amountMinor)
    .slice(0, limit);
}

function buildTimeSlotRows(orders: readonly OnlineOrder[], slotCount: number, readSlot: (order: OnlineOrder) => number): AnalyticsTimeSlotRow[] {
  return Array.from({ length: slotCount }, (_, slot) => {
    const slotOrders = orders.filter((order) => readSlot(order) === slot);
    return { slot, ordersCount: slotOrders.length, revenue: createStoreMoneyForAnalytics(slotOrders.reduce((sum, order) => sum + order.subtotal.amountMinor, 0)) };
  });
}

function buildProductPerformanceRows(orders: readonly OnlineOrder[], fromKey: string, toKey: string): AnalyticsProductPerformance[] {
  const { products, settings } = readMockDatabase();
  const traffic = readStoreTrafficForAnalytics();
  const rangeStoreViews = sumStoreTrafficBetweenDateKeys(fromKey, toKey).storeViews;
  const totalWeight = [...traffic.productViewWeightById.values()].reduce((sum, weight) => sum + weight, 0) || 1;
  const salesByProductId = new Map<string, { units: number; revenueMinor: number; lastSoldAt: string | null }>();
  for (const order of orders) {
    for (const line of order.lines) {
      const current = salesByProductId.get(line.productId) ?? { units: 0, revenueMinor: 0, lastSoldAt: null };
      salesByProductId.set(line.productId, { units: current.units + line.quantity, revenueMinor: current.revenueMinor + line.lineTotal.amountMinor, lastSoldAt: !current.lastSoldAt || order.createdAt > current.lastSoldAt ? order.createdAt : current.lastSoldAt });
    }
  }
  return products
    .filter((product) => product.status === "active")
    .map((product) => {
      const sales = salesByProductId.get(product.id) ?? { units: 0, revenueMinor: 0, lastSoldAt: null };
      const productViews = Math.round(((traffic.productViewWeightById.get(product.id) ?? 1) / totalWeight) * rangeStoreViews * 0.6) + sales.units * 3;
      return {
        productId: product.id,
        name: product.name,
        imageUrl: product.images[0]?.url ?? null,
        categoryName: product.categoryName ?? "Uncategorised",
        unitsSold: sales.units,
        revenue: createStoreMoneyForAnalytics(sales.revenueMinor),
        productViews,
        conversionRateBasisPoints: calculateBasisPointsRatio(sales.units, productViews),
        stockAvailable: product.variants.reduce((sum, variant) => sum + variant.stock.reduce((stockSum, level) => stockSum + Math.max(0, level.onHand - level.reserved), 0), 0),
        lastSoldAt: sales.lastSoldAt ? convertIsoToStoreDateKeyForAnalytics(sales.lastSoldAt, settings.timezone) : null,
      };
    });
}

function buildRefundRows(fromKey: string, toKey: string): AnalyticsRefundRow[] {
  const { returnRequests, settings } = readMockDatabase();
  const fromRefundedOrders = listOrdersPlacedBetweenDateKeys(fromKey, toKey)
    .filter((order) => order.status === "refunded")
    .map((order) => ({ id: `refund_${order.id}`, orderId: order.id, orderNumber: order.orderNumber, customerName: order.buyer.name, amount: order.total, reason: "Order cancelled and refunded", refundedAt: order.createdAt }));
  const fromReturns = returnRequests
    .filter((request) => {
      const dateKey = convertIsoToStoreDateKeyForAnalytics(request.createdAt, settings.timezone);
      return request.status === "refunded" && dateKey >= fromKey && dateKey <= toKey;
    })
    .map((request) => ({ id: `refund_${request.id}`, orderId: request.orderId, orderNumber: request.orderNumber, customerName: request.buyerName, amount: request.refundAmount, reason: request.reason, refundedAt: request.createdAt }));
  return [...fromRefundedOrders, ...fromReturns].sort((first, second) => second.refundedAt.localeCompare(first.refundedAt));
}

export function buildAnalyticsBreakdowns(fromKey: string, toKey: string): AnalyticsBreakdowns {
  const { products, settings } = readMockDatabase();
  const orders = listOrdersPlacedBetweenDateKeys(fromKey, toKey).filter((order) => !ordersExcludedFromSales.has(order.status));
  const categoryNameByProductId = new Map(products.map((product) => [product.id, product.categoryName ?? "Uncategorised"]));
  const byCategory = new Map<string, SegmentAccumulator>();
  const byState = new Map<string, SegmentAccumulator>();
  const byCity = new Map<string, SegmentAccumulator>();
  for (const order of orders) {
    for (const line of order.lines) {
      const categoryName = categoryNameByProductId.get(line.productId) ?? "Uncategorised";
      accumulateSegment(byCategory, categoryName, categoryName, order.id, line.quantity, line.lineTotal.amountMinor);
      accumulateSegment(byState, order.shippingAddress.state, order.shippingAddress.state, order.id, line.quantity, line.lineTotal.amountMinor);
      accumulateSegment(byCity, `${order.shippingAddress.city}|${order.shippingAddress.state}`, `${order.shippingAddress.city}, ${order.shippingAddress.state}`, order.id, line.quantity, line.lineTotal.amountMinor);
    }
  }
  const productRows = buildProductPerformanceRows(orders, fromKey, toKey);
  return {
    from: fromKey,
    to: toKey,
    bestProducts: [...productRows].filter((row) => row.unitsSold > 0).sort((first, second) => second.revenue.amountMinor - first.revenue.amountMinor).slice(0, 10),
    slowProducts: [...productRows].sort((first, second) => first.unitsSold - second.unitsSold || second.stockAvailable - first.stockAvailable).slice(0, 10),
    byCategory: convertSegmentsToRows(byCategory, 12),
    byState: convertSegmentsToRows(byState, 12),
    byCity: convertSegmentsToRows(byCity, 12),
    byHourOfDay: buildTimeSlotRows(orders, 24, (order) => readHourAndWeekdayInStoreTimezone(order.createdAt, settings.timezone).hour),
    byWeekday: buildTimeSlotRows(orders, 7, (order) => readHourAndWeekdayInStoreTimezone(order.createdAt, settings.timezone).weekday),
    refunds: buildRefundRows(fromKey, toKey),
  };
}
