import { orderStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { createStoreMoney, type BuiltReportTable } from "@/mocks/handlers/reportSalesBuilders.mock";
import { calculateBasisPointsShare, convertIsoToStoreDateKey, groupItemsByKey, isDateKeyWithinRange, readWeekStartDateKey, type ReportFilters } from "@/mocks/handlers/reportSalesRecords.mock";
import type { OnlineOrder } from "@/types/order.type";

function listOrdersWithinRange(filters: ReportFilters): OnlineOrder[] {
  const { onlineOrders, settings } = readMockDatabase();
  return onlineOrders.filter((order) => isDateKeyWithinRange(convertIsoToStoreDateKey(order.createdAt, settings.timezone), filters.fromKey, filters.toKey));
}

function calculateHoursBetween(startIso: string, endIso: string): number {
  return Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000);
}

function averageRounded(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildOrdersByStatusReport(filters: ReportFilters): BuiltReportTable {
  const orders = listOrdersWithinRange(filters);
  const totalValueMinor = orders.reduce((sum, order) => sum + order.total.amountMinor, 0);
  const rows = [...groupItemsByKey(orders, (order) => order.status).entries()]
    .map(([status, statusOrders]) => {
      const valueMinor = statusOrders.reduce((sum, order) => sum + order.total.amountMinor, 0);
      return { status: orderStatusPresentation[status as OnlineOrder["status"]]?.label ?? status, orders: statusOrders.length, value: createStoreMoney(valueMinor), share: calculateBasisPointsShare(statusOrders.length, orders.length) };
    })
    .sort((first, second) => second.orders - first.orders);
  return {
    columns: [
      { key: "status", label: "Status", kind: "text" },
      { key: "orders", label: "Orders", kind: "number" },
      { key: "value", label: "Order value", kind: "money" },
      { key: "share", label: "Share of orders", kind: "percent" },
    ],
    rows,
    totals: { status: "Total", orders: orders.length, value: createStoreMoney(totalValueMinor), share: orders.length > 0 ? 10_000 : 0 },
  };
}

export function buildOrderFulfilmentTimeReport(filters: ReportFilters): BuiltReportTable {
  const timezone = readMockDatabase().settings.timezone;
  const shippedOrders = listOrdersWithinRange(filters).filter((order) => order.fulfilment);
  const rows = [...groupItemsByKey(shippedOrders, (order) => readWeekStartDateKey(convertIsoToStoreDateKey(order.createdAt, timezone))).entries()]
    .sort(([firstWeek], [secondWeek]) => firstWeek.localeCompare(secondWeek))
    .map(([weekStart, weekOrders]) => {
      const hoursToShip = weekOrders.map((order) => calculateHoursBetween(order.createdAt, order.fulfilment?.shippedAt ?? order.createdAt));
      const hoursToDeliver = weekOrders.filter((order) => order.deliveredAt && order.fulfilment).map((order) => calculateHoursBetween(order.fulfilment?.shippedAt ?? order.createdAt, order.deliveredAt ?? order.createdAt));
      return { week: weekStart, shipped: weekOrders.length, averageHoursToShip: averageRounded(hoursToShip), averageHoursToDeliver: averageRounded(hoursToDeliver), shippedWithin48Hours: calculateBasisPointsShare(hoursToShip.filter((hours) => hours <= 48).length, hoursToShip.length) };
    });
  const everyHoursToShip = shippedOrders.map((order) => calculateHoursBetween(order.createdAt, order.fulfilment?.shippedAt ?? order.createdAt));
  return {
    columns: [
      { key: "week", label: "Week starting", kind: "date" },
      { key: "shipped", label: "Orders shipped", kind: "number" },
      { key: "averageHoursToShip", label: "Avg hours to ship", kind: "number" },
      { key: "averageHoursToDeliver", label: "Avg hours to deliver", kind: "number" },
      { key: "shippedWithin48Hours", label: "Shipped within 48h", kind: "percent" },
    ],
    rows,
    totals: { week: "All weeks", shipped: shippedOrders.length, averageHoursToShip: averageRounded(everyHoursToShip), averageHoursToDeliver: null, shippedWithin48Hours: calculateBasisPointsShare(everyHoursToShip.filter((hours) => hours <= 48).length, everyHoursToShip.length) },
  };
}

function readFirstOrderDateKeyByBuyer(): Map<string, string> {
  const { onlineOrders, settings } = readMockDatabase();
  const firstOrderByBuyer = new Map<string, string>();
  for (const order of onlineOrders) {
    const dateKey = convertIsoToStoreDateKey(order.createdAt, settings.timezone);
    const known = firstOrderByBuyer.get(order.buyer.id);
    if (!known || dateKey < known) firstOrderByBuyer.set(order.buyer.id, dateKey);
  }
  return firstOrderByBuyer;
}

export function buildNewVersusReturningCustomersReport(filters: ReportFilters): BuiltReportTable {
  const timezone = readMockDatabase().settings.timezone;
  const firstOrderByBuyer = readFirstOrderDateKeyByBuyer();
  const orders = listOrdersWithinRange(filters).filter((order) => order.status !== "cancelled");
  const rows = [...groupItemsByKey(orders, (order) => readWeekStartDateKey(convertIsoToStoreDateKey(order.createdAt, timezone))).entries()]
    .sort(([firstWeek], [secondWeek]) => firstWeek.localeCompare(secondWeek))
    .map(([weekStart, weekOrders]) => {
      const buyers = [...new Set(weekOrders.map((order) => order.buyer.id))];
      const newBuyers = buyers.filter((buyerId) => readWeekStartDateKey(firstOrderByBuyer.get(buyerId) ?? weekStart) === weekStart);
      const newRevenueMinor = weekOrders.filter((order) => newBuyers.includes(order.buyer.id)).reduce((sum, order) => sum + order.subtotal.amountMinor, 0);
      const totalRevenueMinor = weekOrders.reduce((sum, order) => sum + order.subtotal.amountMinor, 0);
      return { week: weekStart, customers: buyers.length, newCustomers: newBuyers.length, returningCustomers: buyers.length - newBuyers.length, newRevenue: createStoreMoney(newRevenueMinor), returningRevenue: createStoreMoney(totalRevenueMinor - newRevenueMinor), returningShare: calculateBasisPointsShare(buyers.length - newBuyers.length, buyers.length) };
    });
  const sumColumn = (key: "customers" | "newCustomers" | "returningCustomers") => rows.reduce((sum, row) => sum + row[key], 0);
  return {
    columns: [
      { key: "week", label: "Week starting", kind: "date" },
      { key: "customers", label: "Customers", kind: "number" },
      { key: "newCustomers", label: "New", kind: "number" },
      { key: "returningCustomers", label: "Returning", kind: "number" },
      { key: "newRevenue", label: "Revenue from new", kind: "money" },
      { key: "returningRevenue", label: "Revenue from returning", kind: "money" },
      { key: "returningShare", label: "Returning share", kind: "percent" },
    ],
    rows,
    totals: { week: "Total", customers: sumColumn("customers"), newCustomers: sumColumn("newCustomers"), returningCustomers: sumColumn("returningCustomers"), newRevenue: createStoreMoney(rows.reduce((sum, row) => sum + row.newRevenue.amountMinor, 0)), returningRevenue: createStoreMoney(rows.reduce((sum, row) => sum + row.returningRevenue.amountMinor, 0)), returningShare: calculateBasisPointsShare(sumColumn("returningCustomers"), sumColumn("customers")) },
  };
}

export function buildTopCustomersReport(filters: ReportFilters): BuiltReportTable {
  const orders = listOrdersWithinRange(filters).filter((order) => !["cancelled", "refunded"].includes(order.status));
  const rows = [...groupItemsByKey(orders, (order) => order.buyer.id).values()]
    .map((buyerOrders) => {
      const spentMinor = buyerOrders.reduce((sum, order) => sum + order.subtotal.amountMinor, 0);
      const latest = buyerOrders.reduce((current, order) => (order.createdAt > current ? order.createdAt : current), buyerOrders[0]?.createdAt ?? "");
      return { customer: buyerOrders[0]?.buyer.name ?? "", username: `@${buyerOrders[0]?.buyer.username ?? ""}`, state: buyerOrders[0]?.shippingAddress.state ?? "", orders: buyerOrders.length, spent: createStoreMoney(spentMinor), averageOrder: createStoreMoney(Math.round(spentMinor / buyerOrders.length)), lastOrder: latest };
    })
    .sort((first, second) => second.spent.amountMinor - first.spent.amountMinor)
    .slice(0, 50);
  const totalSpentMinor = rows.reduce((sum, row) => sum + row.spent.amountMinor, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.orders, 0);
  return {
    columns: [
      { key: "customer", label: "Customer", kind: "text" },
      { key: "username", label: "Username", kind: "text" },
      { key: "state", label: "State", kind: "text" },
      { key: "orders", label: "Orders", kind: "number" },
      { key: "spent", label: "Total spent", kind: "money" },
      { key: "averageOrder", label: "Average order", kind: "money" },
      { key: "lastOrder", label: "Last order", kind: "date" },
    ],
    rows,
    totals: { customer: "Total", username: null, state: null, orders: totalOrders, spent: createStoreMoney(totalSpentMinor), averageOrder: createStoreMoney(totalOrders === 0 ? 0 : Math.round(totalSpentMinor / totalOrders)), lastOrder: null },
  };
}
