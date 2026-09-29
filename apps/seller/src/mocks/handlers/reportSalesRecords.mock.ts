import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { PaymentMethod } from "@/types/store.type";
import { calculateTaxIncludedInGrossMinor, calculateExclusiveTaxMinor } from "@/utils/money.util";
import { findTaxRateBasisPointsForCategory } from "@/utils/posCartPricing.util";

export interface ReportSaleLineRecord {
  readonly channel: "pos" | "online";
  readonly transactionId: string;
  readonly createdAt: string;
  readonly dateKey: string;
  readonly locationId: string | null;
  readonly staffId: string | null;
  readonly staffName: string | null;
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

export interface ReportPaymentRecord {
  readonly channel: "pos" | "online";
  readonly transactionId: string;
  readonly dateKey: string;
  readonly locationId: string | null;
  readonly method: PaymentMethod | "online_checkout";
  readonly amountMinor: number;
}

export function convertIsoToStoreDateKey(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(isoDate));
}

export function isDateKeyWithinRange(dateKey: string, fromKey: string, toKey: string): boolean {
  return dateKey >= fromKey && dateKey <= toKey;
}

const excludedOnlineStatuses = new Set(["cancelled", "refunded"]);

export function collectSaleLineRecords(): ReportSaleLineRecord[] {
  const database = readMockDatabase();
  const { timezone, taxes, pricesIncludeTax } = database.settings;
  const productById = new Map(database.products.map((product) => [product.id, product]));
  const costByVariantId = new Map(database.products.flatMap((product) => product.variants.map((variant) => [variant.id, variant.costPrice?.amountMinor ?? 0] as const)));
  const records: ReportSaleLineRecord[] = [];
  for (const sale of database.sales) {
    if (sale.status === "voided") continue;
    const dateKey = convertIsoToStoreDateKey(sale.createdAt, timezone);
    for (const line of sale.lines) {
      const soldQuantity = line.quantity - line.refundedQuantity;
      if (soldQuantity <= 0) continue;
      const product = productById.get(line.productId);
      const refundShare = soldQuantity / line.quantity;
      records.push({
        channel: "pos",
        transactionId: sale.id,
        createdAt: sale.createdAt,
        dateKey,
        locationId: sale.locationId,
        staffId: sale.cashier.id,
        staffName: sale.cashier.name,
        productId: line.productId,
        productName: line.name,
        categoryId: product?.categoryId ?? null,
        categoryName: product?.categoryName ?? "Uncategorised",
        variantId: line.variantId,
        quantity: soldQuantity,
        revenueMinor: Math.round(line.lineTotal.amountMinor * refundShare),
        taxMinor: Math.round(line.taxAmount.amountMinor * refundShare),
        taxRateBasisPoints: product?.taxable ? findTaxRateBasisPointsForCategory(taxes, product.categoryId) : 0,
        costMinor: (costByVariantId.get(line.variantId) ?? 0) * soldQuantity,
      });
    }
  }
  for (const order of database.onlineOrders) {
    if (excludedOnlineStatuses.has(order.status)) continue;
    const dateKey = convertIsoToStoreDateKey(order.createdAt, timezone);
    for (const line of order.lines) {
      const product = productById.get(line.productId);
      const taxRateBasisPoints = product?.taxable ? findTaxRateBasisPointsForCategory(taxes, product.categoryId) : 0;
      records.push({
        channel: "online",
        transactionId: order.id,
        createdAt: order.createdAt,
        dateKey,
        locationId: null,
        staffId: null,
        staffName: null,
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

export function collectPaymentRecords(): ReportPaymentRecord[] {
  const database = readMockDatabase();
  const { timezone } = database.settings;
  const records: ReportPaymentRecord[] = [];
  for (const sale of database.sales) {
    if (sale.status === "voided") continue;
    const dateKey = convertIsoToStoreDateKey(sale.createdAt, timezone);
    for (const payment of sale.payments) {
      if (payment.status !== "captured") continue;
      records.push({ channel: "pos", transactionId: sale.id, dateKey, locationId: sale.locationId, method: payment.method, amountMinor: payment.amount.amountMinor });
    }
  }
  for (const order of database.onlineOrders) {
    if (excludedOnlineStatuses.has(order.status)) continue;
    records.push({ channel: "online", transactionId: order.id, dateKey: convertIsoToStoreDateKey(order.createdAt, timezone), locationId: null, method: "online_checkout", amountMinor: order.subtotal.amountMinor });
  }
  return records;
}

export interface ReportFilters {
  readonly fromKey: string;
  readonly toKey: string;
  readonly locationId: string | null;
  readonly channel: "all" | "pos" | "online";
}

export function doesRecordMatchReportFilters(record: { readonly channel: "pos" | "online"; readonly dateKey: string; readonly locationId: string | null }, filters: ReportFilters): boolean {
  if (!isDateKeyWithinRange(record.dateKey, filters.fromKey, filters.toKey)) return false;
  if (filters.channel !== "all" && record.channel !== filters.channel) return false;
  if (filters.locationId && record.channel === "pos" && record.locationId !== filters.locationId) return false;
  if (filters.locationId && record.channel === "online" && filters.channel !== "online") return false;
  return true;
}
