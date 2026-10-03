import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { collectSaleLineRecords, doesRecordMatchReportFilters, type ReportFilters } from "@/mocks/handlers/reportSalesRecords.mock";
import { createStoreMoney, type BuiltReportTable } from "@/mocks/handlers/reportSalesBuilders.mock";

export function buildTaxReport(filters: ReportFilters): BuiltReportTable {
  const { taxes, pricesIncludeTax } = readMockDatabase().settings;
  const records = collectSaleLineRecords().filter((record) => doesRecordMatchReportFilters(record, filters));
  const taxableRecords = records.filter((record) => record.taxRateBasisPoints > 0);
  const exemptRecords = records.filter((record) => record.taxRateBasisPoints === 0);
  const rows = taxes.map((tax) => {
    const rateRecords = taxableRecords.filter((record) => record.taxRateBasisPoints === tax.rateBasisPoints);
    const grossMinor = rateRecords.reduce((sum, record) => sum + record.revenueMinor, 0);
    const taxMinor = rateRecords.reduce((sum, record) => sum + record.taxMinor, 0);
    return { taxName: tax.name, rate: tax.rateBasisPoints, taxableSales: createStoreMoney(pricesIncludeTax ? grossMinor - taxMinor : grossMinor), taxCollected: createStoreMoney(taxMinor), grossSales: createStoreMoney(pricesIncludeTax ? grossMinor : grossMinor + taxMinor) };
  });
  const exemptMinor = exemptRecords.reduce((sum, record) => sum + record.revenueMinor, 0);
  rows.push({ taxName: "Exempt (not taxable)", rate: 0, taxableSales: createStoreMoney(0), taxCollected: createStoreMoney(0), grossSales: createStoreMoney(exemptMinor) });
  const sumMoneyColumn = (key: "taxableSales" | "taxCollected" | "grossSales") => createStoreMoney(rows.reduce((sum, row) => sum + row[key].amountMinor, 0));
  return {
    columns: [
      { key: "taxName", label: "Tax", kind: "text" },
      { key: "rate", label: "Rate", kind: "percent" },
      { key: "taxableSales", label: "Taxable sales (net)", kind: "money" },
      { key: "taxCollected", label: "Tax collected", kind: "money" },
      { key: "grossSales", label: "Gross sales", kind: "money" },
    ],
    rows,
    totals: { taxName: "Total", rate: null, taxableSales: sumMoneyColumn("taxableSales"), taxCollected: sumMoneyColumn("taxCollected"), grossSales: sumMoneyColumn("grossSales") },
  };
}

export function buildInventoryValuationReport(filters: ReportFilters): BuiltReportTable {
  const database = readMockDatabase();
  const locationNameById = new Map(database.locations.map((location) => [location.id, location.name]));
  let totalOnHand = 0;
  let totalCostMinor = 0;
  let totalRetailMinor = 0;
  const rows = database.products
    .filter((product) => product.trackInventory && product.status !== "archived")
    .flatMap((product) =>
      product.variants.flatMap((variant) =>
        variant.stock
          .filter((level) => !filters.locationId || level.locationId === filters.locationId)
          .map((level) => {
            const costMinor = level.onHand * (variant.costPrice?.amountMinor ?? 0);
            const retailMinor = level.onHand * variant.price.amountMinor;
            totalOnHand += level.onHand;
            totalCostMinor += costMinor;
            totalRetailMinor += retailMinor;
            return {
              product: product.name,
              variant: variant.title,
              sku: variant.sku,
              location: locationNameById.get(level.locationId) ?? level.locationId,
              onHand: level.onHand,
              unitCost: createStoreMoney(variant.costPrice?.amountMinor ?? 0),
              costValue: createStoreMoney(costMinor),
              retailValue: createStoreMoney(retailMinor),
              potentialProfit: createStoreMoney(retailMinor - costMinor),
            };
          }),
      ),
    );
  return {
    columns: [
      { key: "product", label: "Product", kind: "text" },
      { key: "variant", label: "Variant", kind: "text" },
      { key: "sku", label: "SKU", kind: "text" },
      { key: "location", label: "Location", kind: "text" },
      { key: "onHand", label: "On hand", kind: "number" },
      { key: "unitCost", label: "Unit cost", kind: "money" },
      { key: "costValue", label: "Value at cost", kind: "money" },
      { key: "retailValue", label: "Value at retail", kind: "money" },
      { key: "potentialProfit", label: "Potential profit", kind: "money" },
    ],
    rows,
    totals: { product: "Total", variant: null, sku: null, location: null, onHand: totalOnHand, unitCost: null, costValue: createStoreMoney(totalCostMinor), retailValue: createStoreMoney(totalRetailMinor), potentialProfit: createStoreMoney(totalRetailMinor - totalCostMinor) },
  };
}
