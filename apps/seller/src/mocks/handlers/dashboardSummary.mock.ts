import {
  calculateBasisPointsRatio,
  convertIsoToStoreDateKeyForAnalytics,
  createStoreMoneyForAnalytics,
  listDateKeysInclusive,
  ordersExcludedFromSales,
  readStoreTrafficForAnalytics,
  readTodayDateKeyForStore,
  shiftDateKeyByDays,
  sumStoreTrafficBetweenDateKeys,
} from "@/mocks/handlers/analyticsRecords.mock";
import { listDashboardActivityEntries, listDashboardAlerts } from "@/mocks/handlers/dashboardAlertsAndActivity.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { DashboardCustomerGrowth, DashboardLowStockAlert, DashboardPeriodSales, DashboardSummary, DashboardTrafficSummary } from "@/types/dashboard.type";
import type { OnlineOrder, OnlineOrderStatus } from "@/types/order.type";

const orderStatusDisplayOrder: OnlineOrderStatus[] = ["new", "processing", "ready", "shipped", "delivered", "completed", "cancelled", "returned", "refunded", "disputed"];

interface DatedOrder {
  readonly order: OnlineOrder;
  readonly dateKey: string;
}

function listCountedOrdersWithDateKeys(): DatedOrder[] {
  const { onlineOrders, settings } = readMockDatabase();
  return onlineOrders.filter((order) => !ordersExcludedFromSales.has(order.status)).map((order) => ({ order, dateKey: convertIsoToStoreDateKeyForAnalytics(order.createdAt, settings.timezone) }));
}

function summariseDatedOrders(datedOrders: readonly DatedOrder[], fromKey: string, toKey: string): { revenueMinor: number; ordersCount: number } {
  const matching = datedOrders.filter((entry) => entry.dateKey >= fromKey && entry.dateKey <= toKey);
  return { revenueMinor: matching.reduce((sum, entry) => sum + entry.order.subtotal.amountMinor, 0), ordersCount: matching.length };
}

function buildPeriodSales(datedOrders: readonly DatedOrder[], todayKey: string, lengthInDays: number, label: string): DashboardPeriodSales {
  const currentFromKey = shiftDateKeyByDays(todayKey, -(lengthInDays - 1));
  const current = summariseDatedOrders(datedOrders, currentFromKey, todayKey);
  const previous = summariseDatedOrders(datedOrders, shiftDateKeyByDays(currentFromKey, -lengthInDays), shiftDateKeyByDays(currentFromKey, -1));
  return { label, current: createStoreMoneyForAnalytics(current.revenueMinor), previous: createStoreMoneyForAnalytics(previous.revenueMinor), ordersCount: current.ordersCount };
}

function buildTrafficSummary(datedOrders: readonly DatedOrder[], todayKey: string): DashboardTrafficSummary {
  const monthStartKey = shiftDateKeyByDays(todayKey, -29);
  const previousToKey = shiftDateKeyByDays(monthStartKey, -1);
  const previousFromKey = shiftDateKeyByDays(previousToKey, -29);
  const current = sumStoreTrafficBetweenDateKeys(monthStartKey, todayKey);
  const previous = sumStoreTrafficBetweenDateKeys(previousFromKey, previousToKey);
  const { dailyTrafficByDateKey } = readStoreTrafficForAnalytics();
  return {
    storeViews: current.storeViews,
    previousStoreViews: previous.storeViews,
    visitors: current.visitors,
    conversionRateBasisPoints: calculateBasisPointsRatio(summariseDatedOrders(datedOrders, monthStartKey, todayKey).ordersCount, current.visitors),
    previousConversionRateBasisPoints: calculateBasisPointsRatio(summariseDatedOrders(datedOrders, previousFromKey, previousToKey).ordersCount, previous.visitors),
    dailyStoreViews: listDateKeysInclusive(monthStartKey, todayKey).map((dateKey) => dailyTrafficByDateKey.get(dateKey)?.storeViews ?? 0),
  };
}

function buildCustomerGrowth(todayKey: string): DashboardCustomerGrowth {
  const { customers, settings } = readMockDatabase();
  const monthStartKey = shiftDateKeyByDays(todayKey, -29);
  const previousFromKey = shiftDateKeyByDays(monthStartKey, -30);
  const createdKeys = customers.map((customer) => convertIsoToStoreDateKeyForAnalytics(customer.createdAt, settings.timezone));
  const lastPurchaseKeys = customers.map((customer) => (customer.lastPurchaseAt ? convertIsoToStoreDateKeyForAnalytics(customer.lastPurchaseAt, settings.timezone) : null));
  return {
    totalCustomers: customers.length,
    newCustomers: createdKeys.filter((dateKey) => dateKey >= monthStartKey).length,
    previousNewCustomers: createdKeys.filter((dateKey) => dateKey >= previousFromKey && dateKey < monthStartKey).length,
    returningCustomers: customers.filter((customer, index) => customer.purchasesCount > 1 && (lastPurchaseKeys[index] ?? "") >= monthStartKey).length,
    dailyNewCustomers: listDateKeysInclusive(monthStartKey, todayKey).map((dateKey) => createdKeys.filter((createdKey) => createdKey === dateKey).length),
  };
}

function listLowStockAlerts(locationId: string | null): DashboardLowStockAlert[] {
  return readMockDatabase()
    .products.filter((product) => product.trackInventory && product.status === "active")
    .flatMap((product) =>
      product.variants.flatMap((variant) =>
        variant.stock
          .filter((level) => (!locationId || level.locationId === locationId) && level.onHand - level.reserved <= variant.lowStockThreshold)
          .map((level) => ({ variantId: variant.id, productId: product.id, productName: product.name, variantTitle: variant.title, sku: variant.sku, locationId: level.locationId, available: Math.max(0, level.onHand - level.reserved), lowStockThreshold: variant.lowStockThreshold })),
      ),
    )
    .sort((first, second) => first.available - second.available);
}

export function buildDashboardSummary(locationId: string | null, includeWalletBalances: boolean): DashboardSummary {
  const database = readMockDatabase();
  const todayKey = readTodayDateKeyForStore();
  const datedOrders = listCountedOrdersWithDateKeys();
  const monthStartKey = shiftDateKeyByDays(todayKey, -29);
  const lastThirtyDays = datedOrders.filter((entry) => entry.dateKey >= monthStartKey);

  const dailyRevenue = listDateKeysInclusive(monthStartKey, todayKey).map((dateKey) => {
    const day = summariseDatedOrders(lastThirtyDays, dateKey, dateKey);
    return { date: dateKey, revenue: createStoreMoneyForAnalytics(day.revenueMinor), ordersCount: day.ordersCount };
  });

  const productTotals = new Map<string, { units: number; revenueMinor: number; name: string }>();
  for (const { order } of lastThirtyDays) {
    for (const line of order.lines) {
      const current = productTotals.get(line.productId) ?? { units: 0, revenueMinor: 0, name: line.name };
      productTotals.set(line.productId, { units: current.units + line.quantity, revenueMinor: current.revenueMinor + line.lineTotal.amountMinor, name: current.name });
    }
  }
  const topProducts = [...productTotals.entries()]
    .sort(([, first], [, second]) => second.revenueMinor - first.revenueMinor)
    .slice(0, 5)
    .map(([productId, totals]) => ({ productId, name: totals.name, imageUrl: database.products.find((product) => product.id === productId)?.images[0]?.url ?? null, unitsSold: totals.units, revenue: createStoreMoneyForAnalytics(totals.revenueMinor) }));

  const allLowStockAlerts = listLowStockAlerts(locationId);
  const outOfStockCount = allLowStockAlerts.filter((alert) => alert.available === 0).length;
  const recentOrders = database.onlineOrders.slice(0, 6).map((order) => ({ id: order.id, orderNumber: order.orderNumber, customerName: order.buyer.name, customerUsername: order.buyer.username, itemsCount: order.lines.reduce((sum, line) => sum + line.quantity, 0), total: order.total, status: order.status, createdAt: order.createdAt }));

  return {
    locationId,
    generatedAt: new Date().toISOString(),
    salesToday: buildPeriodSales(datedOrders, todayKey, 1, "Today"),
    salesThisWeek: buildPeriodSales(datedOrders, todayKey, 7, "Last 7 days"),
    salesThisMonth: buildPeriodSales(datedOrders, todayKey, 30, "Last 30 days"),
    lifetimeSales: { total: createStoreMoneyForAnalytics(datedOrders.reduce((sum, entry) => sum + entry.order.subtotal.amountMinor, 0)), ordersCount: datedOrders.length },
    ordersByStatus: orderStatusDisplayOrder.map((status) => ({ status, count: database.onlineOrders.filter((order) => order.status === status).length })),
    dailyRevenue,
    topProducts,
    lowStockAlerts: allLowStockAlerts.slice(0, 8),
    catalog: {
      totalProducts: database.products.filter((product) => product.status !== "archived").length,
      activeProducts: database.products.filter((product) => product.status === "active").length,
      draftProducts: database.products.filter((product) => product.status === "draft").length,
      lowStockCount: allLowStockAlerts.length,
      outOfStockCount,
    },
    traffic: buildTrafficSummary(datedOrders, todayKey),
    customerGrowth: buildCustomerGrowth(todayKey),
    balances: includeWalletBalances ? database.wallet.balances : null,
    recentOrders,
    activity: listDashboardActivityEntries(10),
    alerts: listDashboardAlerts(allLowStockAlerts, outOfStockCount, allLowStockAlerts.length),
  };
}
