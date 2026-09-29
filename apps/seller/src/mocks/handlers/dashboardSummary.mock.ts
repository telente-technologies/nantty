import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { collectSaleLineRecords, convertIsoToStoreDateKey, type ReportSaleLineRecord } from "@/mocks/handlers/reportSalesRecords.mock";
import type { DashboardPeriodSales, DashboardRecentActivity, DashboardSummary } from "@/types/dashboard.type";
import type { OnlineOrderStatus } from "@/types/order.type";
import type { CurrencyCode } from "@/types/money.type";

const orderStatusDisplayOrder: OnlineOrderStatus[] = ["paid", "processing", "shipped", "delivered", "completed", "disputed", "cancelled", "refunded"];

function shiftDateKeyByDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function summariseRecordsBetween(records: readonly ReportSaleLineRecord[], fromKey: string, toKey: string): { revenueMinor: number; transactionsCount: number } {
  const matching = records.filter((record) => record.dateKey >= fromKey && record.dateKey <= toKey);
  return { revenueMinor: matching.reduce((sum, record) => sum + record.revenueMinor, 0), transactionsCount: new Set(matching.map((record) => record.transactionId)).size };
}

function buildPeriodSales(records: readonly ReportSaleLineRecord[], todayKey: string, lengthInDays: number, label: string, currency: CurrencyCode): DashboardPeriodSales {
  const currentFromKey = shiftDateKeyByDays(todayKey, -(lengthInDays - 1));
  const current = summariseRecordsBetween(records, currentFromKey, todayKey);
  const previous = summariseRecordsBetween(records, shiftDateKeyByDays(currentFromKey, -lengthInDays), shiftDateKeyByDays(currentFromKey, -1));
  return { label, current: { amountMinor: current.revenueMinor, currency }, previous: { amountMinor: previous.revenueMinor, currency }, transactionsCount: current.transactionsCount };
}

export function buildDashboardSummary(locationId: string | null, includeWalletBalances: boolean): DashboardSummary {
  const database = readMockDatabase();
  const { currency, timezone } = database.settings;
  const todayKey = convertIsoToStoreDateKey(new Date().toISOString(), timezone);
  const records = collectSaleLineRecords().filter((record) => !locationId || record.channel === "online" || record.locationId === locationId);
  const monthStartKey = shiftDateKeyByDays(todayKey, -29);
  const lastThirtyDaysRecords = records.filter((record) => record.dateKey >= monthStartKey);

  const dailyRevenue = Array.from({ length: 30 }, (_, index) => {
    const dateKey = shiftDateKeyByDays(monthStartKey, index);
    const dayRecords = lastThirtyDaysRecords.filter((record) => record.dateKey === dateKey);
    const sumForChannel = (channel: "pos" | "online") => dayRecords.filter((record) => record.channel === channel).reduce((sum, record) => sum + record.revenueMinor, 0);
    return { date: dateKey, online: { amountMinor: sumForChannel("online"), currency }, pos: { amountMinor: sumForChannel("pos"), currency } };
  });

  const productTotals = new Map<string, { units: number; revenueMinor: number; name: string }>();
  for (const record of lastThirtyDaysRecords) {
    const current = productTotals.get(record.productId) ?? { units: 0, revenueMinor: 0, name: record.productName };
    productTotals.set(record.productId, { units: current.units + record.quantity, revenueMinor: current.revenueMinor + record.revenueMinor, name: current.name });
  }
  const topProducts = [...productTotals.entries()]
    .sort(([, first], [, second]) => second.revenueMinor - first.revenueMinor)
    .slice(0, 6)
    .map(([productId, totals]) => ({ productId, name: totals.name, imageUrl: database.products.find((product) => product.id === productId)?.images[0]?.url ?? null, unitsSold: totals.units, revenue: { amountMinor: totals.revenueMinor, currency } }));

  const lowStockAlerts = database.products
    .filter((product) => product.trackInventory && product.status === "active")
    .flatMap((product) =>
      product.variants.flatMap((variant) =>
        variant.stock
          .filter((level) => (!locationId || level.locationId === locationId) && level.onHand - level.reserved <= variant.lowStockThreshold)
          .map((level) => ({ variantId: variant.id, productId: product.id, productName: product.name, variantTitle: variant.title, sku: variant.sku, locationId: level.locationId, available: Math.max(0, level.onHand - level.reserved), lowStockThreshold: variant.lowStockThreshold })),
      ),
    )
    .sort((first, second) => first.available - second.available)
    .slice(0, 12);

  const recentSales: DashboardRecentActivity[] = database.sales
    .filter((sale) => !locationId || sale.locationId === locationId)
    .slice(0, 6)
    .map((sale) => ({ kind: "pos_sale", id: sale.id, reference: sale.receiptNumber, customerName: sale.customer?.name ?? null, total: sale.total, status: sale.status, createdAt: sale.createdAt }));
  const recentOrders: DashboardRecentActivity[] = database.onlineOrders.slice(0, 6).map((order) => ({ kind: "online_order", id: order.id, reference: order.orderNumber, customerName: order.buyer.name, total: order.total, status: order.status, createdAt: order.createdAt }));

  const sumChannel = (channel: "pos" | "online") => lastThirtyDaysRecords.filter((record) => record.channel === channel).reduce((sum, record) => sum + record.revenueMinor, 0);
  return {
    locationId,
    generatedAt: new Date().toISOString(),
    salesToday: buildPeriodSales(records, todayKey, 1, "Today", currency),
    salesThisWeek: buildPeriodSales(records, todayKey, 7, "Last 7 days", currency),
    salesThisMonth: buildPeriodSales(records, todayKey, 30, "Last 30 days", currency),
    ordersByStatus: orderStatusDisplayOrder.map((status) => ({ status, count: database.onlineOrders.filter((order) => order.status === status).length })),
    channelSplit: { online: { amountMinor: sumChannel("online"), currency }, pos: { amountMinor: sumChannel("pos"), currency } },
    dailyRevenue,
    topProducts,
    lowStockAlerts,
    balances: includeWalletBalances ? database.wallet.balances : null,
    recentActivity: [...recentSales, ...recentOrders].sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 8),
  };
}
