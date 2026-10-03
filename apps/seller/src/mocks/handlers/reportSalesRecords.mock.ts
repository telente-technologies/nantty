import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { calculateExclusiveTaxMinor, calculateTaxIncludedInGrossMinor } from "@/utils/money.util";
import { findTaxRateBasisPointsForCategory } from "@/utils/pricingRules.util";

export interface ReportSaleLineRecord {
  readonly orderId: string;
  readonly createdAt: string;
  readonly dateKey: string;
  readonly locationId: string | null;
  readonly buyerId: string;
  readonly buyerName: string;
  readonly buyerUsername: string;
  readonly buyerState: string;
  readonly productId: string;
  readonly productName: string;
  readonly categoryId: string | null;
  readonly categoryName: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly revenueMinor: number;
  readonly taxMinor: number;
  readonly taxRateBasisPoints: number;
  readonly costMinor: number;
}

export interface ReportFilters {
  readonly fromKey: string;
  readonly toKey: string;
  readonly locationId: string | null;
}

export function convertIsoToStoreDateKey(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(isoDate));
}

export function isDateKeyWithinRange(dateKey: string, fromKey: string, toKey: string): boolean {
  return dateKey >= fromKey && dateKey <= toKey;
}

const statusesExcludedFromSales = new Set(["cancelled", "refunded", "returned"]);

export function collectSaleLineRecords(): ReportSaleLineRecord[] {
  const database = readMockDatabase();
  const { timezone, taxes, pricesIncludeTax } = database.settings;
  const productById = new Map(database.products.map((product) => [product.id, product]));
  const costByVariantId = new Map(database.products.flatMap((product) => product.variants.map((variant) => [variant.id, variant.costPrice?.amountMinor ?? 0] as const)));
  const records: ReportSaleLineRecord[] = [];
  for (const order of database.onlineOrders) {
    if (statusesExcludedFromSales.has(order.status)) continue;
    const dateKey = convertIsoToStoreDateKey(order.createdAt, timezone);
    for (const line of order.lines) {
      const product = productById.get(line.productId);
      const taxRateBasisPoints = product?.taxable ? findTaxRateBasisPointsForCategory(taxes, product.categoryId) : 0;
      records.push({
        orderId: order.id,
        createdAt: order.createdAt,
        dateKey,
        locationId: order.fulfilment?.fromLocationId ?? null,
        buyerId: order.buyer.id,
        buyerName: order.buyer.name,
        buyerUsername: order.buyer.username,
        buyerState: order.shippingAddress.state,
        productId: line.productId,
        productName: line.name,
        categoryId: product?.categoryId ?? null,
        categoryName: product?.categoryName ?? "Uncategorised",
        variantId: line.variantId,
        quantity: line.quantity,
        revenueMinor: line.lineTotal.amountMinor,
        taxMinor: pricesIncludeTax ? calculateTaxIncludedInGrossMinor(line.lineTotal.amountMinor, taxRateBasisPoints) : calculateExclusiveTaxMinor(line.lineTotal.amountMinor, taxRateBasisPoints),
        taxRateBasisPoints,
        costMinor: (costByVariantId.get(line.variantId) ?? 0) * line.quantity,
      });
    }
  }
  return records;
}

export function doesRecordMatchReportFilters(record: { readonly dateKey: string; readonly locationId: string | null }, filters: ReportFilters): boolean {
  if (!isDateKeyWithinRange(record.dateKey, filters.fromKey, filters.toKey)) return false;
  if (filters.locationId && record.locationId !== filters.locationId) return false;
  return true;
}

export function listDateKeysBetween(fromKey: string, toKey: string): string[] {
  const dateKeys: string[] = [];
  const cursor = new Date(`${fromKey}T12:00:00.000Z`);
  while (cursor.toISOString().slice(0, 10) <= toKey && dateKeys.length < 400) {
    dateKeys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dateKeys;
}

export function readWeekStartDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function groupItemsByKey<Item>(items: readonly Item[], readGroupKey: (item: Item) => string): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const groupKey = readGroupKey(item);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
  }
  return groups;
}

export function calculateBasisPointsShare(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part * 10_000) / whole);
}
