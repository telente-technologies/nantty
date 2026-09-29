import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { collectPaymentRecords, collectSaleLineRecords, doesRecordMatchReportFilters, type ReportFilters, type ReportSaleLineRecord } from "@/mocks/handlers/reportSalesRecords.mock";
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

function calculateBasisPointsShare(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part * 10_000) / whole);
}

function groupRecordsBy<Record>(records: readonly Record[], readGroupKey: (record: Record) => string): Map<string, Record[]> {
  const groups = new Map<string, Record[]>();
  for (const record of records) {
    const groupKey = readGroupKey(record);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), record]);
  }
  return groups;
}

function sumRevenue(records: readonly ReportSaleLineRecord[]): number {
  return records.reduce((sum, record) => sum + record.revenueMinor, 0);
}

function countTransactions(records: readonly { readonly transactionId: string }[]): number {
  return new Set(records.map((record) => record.transactionId)).size;
}

function sumQuantity(records: readonly ReportSaleLineRecord[]): number {
  return records.reduce((sum, record) => sum + record.quantity, 0);
}

function listDateKeysBetween(fromKey: string, toKey: string): string[] {
  const dateKeys: string[] = [];
  const cursor = new Date(`${fromKey}T12:00:00.000Z`);
  while (cursor.toISOString().slice(0, 10) <= toKey && dateKeys.length < 400) {
    dateKeys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dateKeys;
}

export function buildSalesByDayReport(filters: ReportFilters): BuiltReportTable {
  const records = collectSaleLineRecords().filter((record) => doesRecordMatchReportFilters(record, filters));
  const recordsByDay = groupRecordsBy(records, (record) => record.dateKey);
  const rows = listDateKeysBetween(filters.fromKey, filters.toKey).map((dateKey) => {
    const dayRecords = recordsByDay.get(dateKey) ?? [];
    const posRecords = dayRecords.filter((record) => record.channel === "pos");
    const onlineRecords = dayRecords.filter((record) => record.channel === "online");
    return { date: dateKey, transactions: countTransactions(dayRecords), items: sumQuantity(dayRecords), pos: createStoreMoney(sumRevenue(posRecords)), online: createStoreMoney(sumRevenue(onlineRecords)), revenue: createStoreMoney(sumRevenue(dayRecords)) };
  });
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "transactions", label: "Transactions", kind: "number" },
      { key: "items", label: "Items", kind: "number" },
      { key: "pos", label: "In store", kind: "money" },
      { key: "online", label: "Online", kind: "money" },
      { key: "revenue", label: "Revenue", kind: "money" },
    ],
    rows,
    totals: { date: "Total", transactions: countTransactions(records), items: sumQuantity(records), pos: createStoreMoney(sumRevenue(records.filter((record) => record.channel === "pos"))), online: createStoreMoney(sumRevenue(records.filter((record) => record.channel === "online"))), revenue: createStoreMoney(sumRevenue(records)) },
  };
}

export function buildSalesByProductReport(filters: ReportFilters): BuiltReportTable {
  const records = collectSaleLineRecords().filter((record) => doesRecordMatchReportFilters(record, filters));
  const rows = [...groupRecordsBy(records, (record) => record.productId).values()]
    .map((productRecords) => {
      const revenueMinor = sumRevenue(productRecords);
      const costMinor = productRecords.reduce((sum, record) => sum + record.costMinor, 0);
      const first = productRecords[0];
      return { product: first?.productName ?? "", category: first?.categoryName ?? "", units: sumQuantity(productRecords), revenue: createStoreMoney(revenueMinor), cost: createStoreMoney(costMinor), grossProfit: createStoreMoney(revenueMinor - costMinor), margin: calculateBasisPointsShare(revenueMinor - costMinor, revenueMinor) };
    })
    .sort((first, second) => (second.revenue as Money).amountMinor - (first.revenue as Money).amountMinor);
  const revenueMinor = sumRevenue(records);
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

export function buildSalesByCategoryReport(filters: ReportFilters): BuiltReportTable {
  const records = collectSaleLineRecords().filter((record) => doesRecordMatchReportFilters(record, filters));
  const totalRevenueMinor = sumRevenue(records);
  const rows = [...groupRecordsBy(records, (record) => record.categoryName).entries()]
    .map(([categoryName, categoryRecords]) => ({ category: categoryName, units: sumQuantity(categoryRecords), revenue: createStoreMoney(sumRevenue(categoryRecords)), share: calculateBasisPointsShare(sumRevenue(categoryRecords), totalRevenueMinor) }))
    .sort((first, second) => second.revenue.amountMinor - first.revenue.amountMinor);
  return {
    columns: [
      { key: "category", label: "Category", kind: "text" },
      { key: "units", label: "Units", kind: "number" },
      { key: "revenue", label: "Revenue", kind: "money" },
      { key: "share", label: "Share of revenue", kind: "percent" },
    ],
    rows,
    totals: { category: "Total", units: sumQuantity(records), revenue: createStoreMoney(totalRevenueMinor), share: totalRevenueMinor > 0 ? 10_000 : 0 },
  };
}

export function buildSalesByStaffReport(filters: ReportFilters): BuiltReportTable {
  const records = collectSaleLineRecords().filter((record) => record.channel === "pos" && doesRecordMatchReportFilters(record, { ...filters, channel: "pos" }));
  const rows = [...groupRecordsBy(records, (record) => record.staffId ?? "unknown").values()]
    .map((staffRecords) => {
      const revenueMinor = sumRevenue(staffRecords);
      const transactions = countTransactions(staffRecords);
      return { staff: staffRecords[0]?.staffName ?? "Unknown", transactions, items: sumQuantity(staffRecords), revenue: createStoreMoney(revenueMinor), averageSale: createStoreMoney(transactions === 0 ? 0 : Math.round(revenueMinor / transactions)) };
    })
    .sort((first, second) => second.revenue.amountMinor - first.revenue.amountMinor);
  const transactions = countTransactions(records);
  return {
    columns: [
      { key: "staff", label: "Staff member", kind: "text" },
      { key: "transactions", label: "Sales", kind: "number" },
      { key: "items", label: "Items", kind: "number" },
      { key: "revenue", label: "Revenue", kind: "money" },
      { key: "averageSale", label: "Average sale", kind: "money" },
    ],
    rows,
    totals: { staff: "Total", transactions, items: sumQuantity(records), revenue: createStoreMoney(sumRevenue(records)), averageSale: createStoreMoney(transactions === 0 ? 0 : Math.round(sumRevenue(records) / transactions)) },
  };
}

const paymentMethodLabels: Record<string, string> = { cash: "Cash", card: "Card (terminal)", bank_transfer: "Bank transfer", zudomart_wallet: "Zudomart wallet", pay_link: "Pay link", online_checkout: "Online checkout (escrow)" };

export function buildSalesByPaymentMethodReport(filters: ReportFilters): BuiltReportTable {
  const records = collectPaymentRecords().filter((record) => doesRecordMatchReportFilters(record, filters));
  const totalMinor = records.reduce((sum, record) => sum + record.amountMinor, 0);
  const rows = [...groupRecordsBy(records, (record) => record.method).entries()]
    .map(([method, methodRecords]) => {
      const amountMinor = methodRecords.reduce((sum, record) => sum + record.amountMinor, 0);
      return { method: paymentMethodLabels[method] ?? method, transactions: countTransactions(methodRecords), amount: createStoreMoney(amountMinor), share: calculateBasisPointsShare(amountMinor, totalMinor) };
    })
    .sort((first, second) => second.amount.amountMinor - first.amount.amountMinor);
  return {
    columns: [
      { key: "method", label: "Payment method", kind: "text" },
      { key: "transactions", label: "Transactions", kind: "number" },
      { key: "amount", label: "Amount", kind: "money" },
      { key: "share", label: "Share", kind: "percent" },
    ],
    rows,
    totals: { method: "Total", transactions: countTransactions(records), amount: createStoreMoney(totalMinor), share: totalMinor > 0 ? 10_000 : 0 },
  };
}

export function buildSalesByLocationReport(filters: ReportFilters): BuiltReportTable {
  const locations = readMockDatabase().locations;
  const records = collectSaleLineRecords().filter((record) => doesRecordMatchReportFilters(record, filters));
  const totalRevenueMinor = sumRevenue(records);
  const rows = [...groupRecordsBy(records, (record) => record.locationId ?? "online").entries()]
    .map(([locationKey, locationRecords]) => ({
      location: locationKey === "online" ? "Online marketplace" : locations.find((location) => location.id === locationKey)?.name ?? locationKey,
      transactions: countTransactions(locationRecords),
      items: sumQuantity(locationRecords),
      revenue: createStoreMoney(sumRevenue(locationRecords)),
      share: calculateBasisPointsShare(sumRevenue(locationRecords), totalRevenueMinor),
    }))
    .sort((first, second) => second.revenue.amountMinor - first.revenue.amountMinor);
  return {
    columns: [
      { key: "location", label: "Location", kind: "text" },
      { key: "transactions", label: "Transactions", kind: "number" },
      { key: "items", label: "Items", kind: "number" },
      { key: "revenue", label: "Revenue", kind: "money" },
      { key: "share", label: "Share", kind: "percent" },
    ],
    rows,
    totals: { location: "Total", transactions: countTransactions(records), items: sumQuantity(records), revenue: createStoreMoney(totalRevenueMinor), share: totalRevenueMinor > 0 ? 10_000 : 0 },
  };
}
