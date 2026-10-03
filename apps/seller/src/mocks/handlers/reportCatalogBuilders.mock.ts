import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { collectFilteredSaleLineRecords, countDistinctOrders, createStoreMoney, sumQuantity, sumRevenueMinor, type BuiltReportTable } from "@/mocks/handlers/reportSalesBuilders.mock";
import { groupItemsByKey, type ReportFilters } from "@/mocks/handlers/reportSalesRecords.mock";

export function buildLowStockReport(filters: ReportFilters): BuiltReportTable {
  const database = readMockDatabase();
  const locationNameById = new Map(database.locations.map((location) => [location.id, location.name]));
  const rows = database.products
    .filter((product) => product.trackInventory && product.status === "active")
    .flatMap((product) =>
      product.variants.flatMap((variant) =>
        variant.stock
          .filter((level) => (!filters.locationId || level.locationId === filters.locationId) && level.onHand - level.reserved <= variant.lowStockThreshold)
          .map((level) => {
            const available = Math.max(0, level.onHand - level.reserved);
            const suggestedReorder = Math.max(variant.lowStockThreshold * 2 - available, 1);
            return {
              product: product.name,
              variant: variant.title,
              sku: variant.sku,
              location: locationNameById.get(level.locationId) ?? level.locationId,
              status: available === 0 ? "Out of stock" : "Low stock",
              available,
              reorderLevel: variant.lowStockThreshold,
              suggestedReorder,
              reorderCost: createStoreMoney(suggestedReorder * (variant.costPrice?.amountMinor ?? 0)),
            };
          }),
      ),
    )
    .sort((first, second) => first.available - second.available);
  return {
    columns: [
      { key: "product", label: "Product", kind: "text" },
      { key: "variant", label: "Variant", kind: "text" },
      { key: "sku", label: "SKU", kind: "text" },
      { key: "location", label: "Location", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
      { key: "available", label: "Available", kind: "number" },
      { key: "reorderLevel", label: "Reorder level", kind: "number" },
      { key: "suggestedReorder", label: "Suggested reorder", kind: "number" },
      { key: "reorderCost", label: "Reorder cost", kind: "money" },
    ],
    rows,
    totals: { product: "Total", variant: null, sku: null, location: null, status: `${rows.length} variants`, available: null, reorderLevel: null, suggestedReorder: rows.reduce((sum, row) => sum + row.suggestedReorder, 0), reorderCost: createStoreMoney(rows.reduce((sum, row) => sum + row.reorderCost.amountMinor, 0)) },
  };
}

export function buildBestSellersReport(filters: ReportFilters): BuiltReportTable {
  const records = collectFilteredSaleLineRecords(filters);
  const rows = [...groupItemsByKey(records, (record) => record.productId).values()]
    .map((productRecords) => ({ product: productRecords[0]?.productName ?? "", category: productRecords[0]?.categoryName ?? "", units: sumQuantity(productRecords), orders: countDistinctOrders(productRecords), revenue: createStoreMoney(sumRevenueMinor(productRecords)) }))
    .sort((first, second) => second.units - first.units)
    .slice(0, 25)
    .map((row, index) => ({ rank: index + 1, ...row }));
  return {
    columns: [
      { key: "rank", label: "Rank", kind: "number" },
      { key: "product", label: "Product", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "units", label: "Units sold", kind: "number" },
      { key: "orders", label: "Orders", kind: "number" },
      { key: "revenue", label: "Revenue", kind: "money" },
    ],
    rows,
    totals: { rank: null, product: "Top 25", category: null, units: rows.reduce((sum, row) => sum + row.units, 0), orders: null, revenue: createStoreMoney(rows.reduce((sum, row) => sum + row.revenue.amountMinor, 0)) },
  };
}

export function buildSlowSellersReport(filters: ReportFilters): BuiltReportTable {
  const database = readMockDatabase();
  const unitsByProductId = new Map<string, number>();
  for (const record of collectFilteredSaleLineRecords(filters)) unitsByProductId.set(record.productId, (unitsByProductId.get(record.productId) ?? 0) + record.quantity);
  const rows = database.products
    .filter((product) => product.status === "active")
    .map((product) => {
      const onHand = product.variants.reduce((sum, variant) => sum + variant.stock.reduce((stockSum, level) => stockSum + level.onHand, 0), 0);
      const stockValueMinor = product.variants.reduce((sum, variant) => sum + variant.stock.reduce((stockSum, level) => stockSum + level.onHand, 0) * (variant.costPrice?.amountMinor ?? 0), 0);
      return { product: product.name, category: product.categoryName ?? "Uncategorised", units: unitsByProductId.get(product.id) ?? 0, onHand, stockValue: createStoreMoney(stockValueMinor) };
    })
    .filter((row) => row.units <= 2)
    .sort((first, second) => first.units - second.units || second.stockValue.amountMinor - first.stockValue.amountMinor);
  return {
    columns: [
      { key: "product", label: "Product", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "units", label: "Units sold", kind: "number" },
      { key: "onHand", label: "On hand", kind: "number" },
      { key: "stockValue", label: "Stock value at cost", kind: "money" },
    ],
    rows,
    totals: { product: "Total", category: null, units: rows.reduce((sum, row) => sum + row.units, 0), onHand: rows.reduce((sum, row) => sum + row.onHand, 0), stockValue: createStoreMoney(rows.reduce((sum, row) => sum + row.stockValue.amountMinor, 0)) },
  };
}
