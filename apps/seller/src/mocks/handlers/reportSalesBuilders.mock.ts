import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { calculateBasisPointsShare, collectSaleLineRecords, doesRecordMatchReportFilters, groupItemsByKey, listDateKeysBetween, type ReportFilters, type ReportSaleLineRecord } from "@/mocks/handlers/reportSalesRecords.mock";
import type { Money } from "@/types/money.type";
import type { ReportCellValue, ReportColumn } from "@/types/report.type";

export interface BuiltReportTable {
  readonly columns: ReportColumn[];
  readonly rows: Record<string, ReportCellValue>[];
  readonly totals: Record<string, ReportCellValue> | null;
}

export function createStoreMoney(amountMinor: number): Money {
  return { amountMinor, currency: readMockDatabase().settings.currency };
}

export function sumRevenueMinor(records: readonly ReportSaleLineRecord[]): number {
  return records.reduce((sum, record) => sum + record.revenueMinor, 0);
}

export function countDistinctOrders(records: readonly { readonly orderId: string }[]): number {
  return new Set(records.map((record) => record.orderId)).size;
}

export function sumQuantity(records: readonly ReportSaleLineRecord[]): number {
  return records.reduce((sum, record) => sum + record.quantity, 0);
}

export function collectFilteredSaleLineRecords(filters: ReportFilters): ReportSaleLineRecord[] {
  return collectSaleLineRecords().filter((record) => doesRecordMatchReportFilters(record, filters));
}

function calculateAverageOrderMinor(records: readonly ReportSaleLineRecord[]): number {
  const orders = countDistinctOrders(records);
  return orders === 0 ? 0 : Math.round(sumRevenueMinor(records) / orders);
}

export function buildSalesByDayReport(filters: ReportFilters): BuiltReportTable {
  const records = collectFilteredSaleLineRecords(filters);
  const recordsByDay = groupItemsByKey(records, (record) => record.dateKey);
  const rows = listDateKeysBetween(filters.fromKey, filters.toKey).map((dateKey) => {
    const dayRecords = recordsByDay.get(dateKey) ?? [];
    return { date: dateKey, orders: countDistinctOrders(dayRecords), items: sumQuantity(dayRecords), averageOrder: createStoreMoney(calculateAverageOrderMinor(dayRecords)), revenue: createStoreMoney(sumRevenueMinor(dayRecords)) };
  });
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "orders", label: "Orders", kind: "number" },
      { key: "items", label: "Items", kind: "number" },
      { key: "averageOrder", label: "Average order", kind: "money" },
      { key: "revenue", label: "Revenue", kind: "money" },
    ],
    rows,
    totals: { date: "Total", orders: countDistinctOrders(records), items: sumQuantity(records), averageOrder: createStoreMoney(calculateAverageOrderMinor(records)), revenue: createStoreMoney(sumRevenueMinor(records)) },
  };
}

export function buildSalesByProductReport(filters: ReportFilters): BuiltReportTable {
  const records = collectFilteredSaleLineRecords(filters);
  const rows = [...groupItemsByKey(records, (record) => record.productId).values()]
    .map((productRecords) => {
      const revenueMinor = sumRevenueMinor(productRecords);
      const costMinor = productRecords.reduce((sum, record) => sum + record.costMinor, 0);
      return { product: productRecords[0]?.productName ?? "", category: productRecords[0]?.categoryName ?? "", units: sumQuantity(productRecords), revenue: createStoreMoney(revenueMinor), cost: createStoreMoney(costMinor), grossProfit: createStoreMoney(revenueMinor - costMinor), margin: calculateBasisPointsShare(revenueMinor - costMinor, revenueMinor) };
    })
    .sort((first, second) => second.revenue.amountMinor - first.revenue.amountMinor);
  const revenueMinor = sumRevenueMinor(records);
  const costMinor = records.reduce((sum, record) => sum + record.costMinor, 0);
  return {
    columns: [
      { key: "product", label: "Product", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "units", label: "Units", kind: "number" },
      { key: "revenue", label: "Revenue", kind: "money" },
      { key: "cost", label: "Cost", kind: "money" },
      { key: "grossProfit", label: "Gross profit", kind: "money" },
      { key: "margin", label: "Margin", kind: "percent" },
    ],
    rows,
    totals: { product: "Total", category: null, units: sumQuantity(records), revenue: createStoreMoney(revenueMinor), cost: createStoreMoney(costMinor), grossProfit: createStoreMoney(revenueMinor - costMinor), margin: calculateBasisPointsShare(revenueMinor - costMinor, revenueMinor) },
  };
}

function buildRevenueShareReport(filters: ReportFilters, groupLabel: string, readGroupName: (record: ReportSaleLineRecord) => string): BuiltReportTable {
  const records = collectFilteredSaleLineRecords(filters);
  const totalRevenueMinor = sumRevenueMinor(records);
  const rows = [...groupItemsByKey(records, readGroupName).entries()]
    .map(([groupName, groupRecords]) => ({ group: groupName, orders: countDistinctOrders(groupRecords), units: sumQuantity(groupRecords), revenue: createStoreMoney(sumRevenueMinor(groupRecords)), share: calculateBasisPointsShare(sumRevenueMinor(groupRecords), totalRevenueMinor) }))
    .sort((first, second) => second.revenue.amountMinor - first.revenue.amountMinor);
  return {
    columns: [
      { key: "group", label: groupLabel, kind: "text" },
      { key: "orders", label: "Orders", kind: "number" },
      { key: "units", label: "Units", kind: "number" },
      { key: "revenue", label: "Revenue", kind: "money" },
      { key: "share", label: "Share of revenue", kind: "percent" },
    ],
    rows,
    totals: { group: "Total", orders: countDistinctOrders(records), units: sumQuantity(records), revenue: createStoreMoney(totalRevenueMinor), share: totalRevenueMinor > 0 ? 10_000 : 0 },
  };
}

export function buildSalesByCategoryReport(filters: ReportFilters): BuiltReportTable {
  return buildRevenueShareReport(filters, "Category", (record) => record.categoryName);
}

export function buildSalesByLocationReport(filters: ReportFilters): BuiltReportTable {
  return buildRevenueShareReport(filters, "Customer state", (record) => record.buyerState);
}
