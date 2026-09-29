import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { runOnceForIdempotencyKey } from "@/mocks/mockIdempotency.mock";
import { MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithCsv, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { buildMockProductFromRequest, recordCatalogAuditEntry, replaceMockProduct, validateProductRequestAgainstStore } from "@/mocks/handlers/productCatalogStore.mock";
import { productCsvColumns, readYesNoCell } from "@/constants/productCsvColumns.constant";
import type { ProductImportRow, ProductImportResult, ProductVariantUpsertRequest } from "@/types/productRequests.type";
import type { CurrencyCode } from "@/types/money.type";
import { convertRowsToCsvText } from "@/utils/csvFile.util";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";

const maximumImportRows = 2000;

function readImportRows(value: unknown): ProductImportRow[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximumImportRows) throw new MockHttpError(400, "INVALID_ROWS", `Send between 1 and ${maximumImportRows} rows.`);
  return value.map((rawRow, index) => {
    const record = (typeof rawRow === "object" && rawRow !== null ? rawRow : {}) as Record<string, unknown>;
    const text = (key: string) => (typeof record[key] === "string" ? String(record[key]).slice(0, 5000) : "");
    return {
      rowNumber: typeof record.rowNumber === "number" ? record.rowNumber : index + 2,
      productName: text("productName"), description: text("description"), categoryName: text("categoryName"),
      option1Name: text("option1Name"), option1Value: text("option1Value"), option2Name: text("option2Name"), option2Value: text("option2Value"),
      sku: text("sku"), barcode: text("barcode"), price: text("price"), compareAtPrice: text("compareAtPrice"), costPrice: text("costPrice"),
      lowStockThreshold: text("lowStockThreshold"), openingStock: text("openingStock"), taxable: text("taxable"), publishedOnline: text("publishedOnline"),
    };
  });
}

function parseOptionalMinor(text: string, currency: CurrencyCode): number | null | "invalid" {
  if (text.trim() === "") return null;
  return convertMajorInputToMinorUnits(text, currency) ?? "invalid";
}

function convertRowToVariantRequest(row: ProductImportRow, currency: CurrencyCode, locationId: string): ProductVariantUpsertRequest | string {
  const priceMinor = convertMajorInputToMinorUnits(row.price, currency);
  if (priceMinor === null) return "Price must be a number like 18500 or 18500.00.";
  const compareAtPriceMinor = parseOptionalMinor(row.compareAtPrice, currency);
  const costPriceMinor = parseOptionalMinor(row.costPrice, currency);
  if (compareAtPriceMinor === "invalid" || costPriceMinor === "invalid") return "Compare-at and cost prices must be numbers.";
  const lowStockThreshold = row.lowStockThreshold.trim() === "" ? 5 : Number(row.lowStockThreshold);
  const openingQuantity = row.openingStock.trim() === "" ? 0 : Number(row.openingStock);
  const optionValues: Record<string, string> = {};
  if (row.option1Name.trim()) optionValues[row.option1Name.trim()] = row.option1Value.trim();
  if (row.option2Name.trim()) optionValues[row.option2Name.trim()] = row.option2Value.trim();
  return { id: null, optionValues, sku: row.sku.trim(), barcode: row.barcode.trim() || null, priceMinor, compareAtPriceMinor, costPriceMinor, lowStockThreshold, openingStock: [{ locationId, quantity: openingQuantity }] };
}

function importProductRows(rows: ProductImportRow[], locationId: string): ProductImportResult {
  const database = readMockDatabase();
  const currency = database.settings.currency;
  const failed: { row: number; message: string }[] = [];
  let updated = 0;
  let created = 0;
  const newProductGroups = new Map<string, ProductImportRow[]>();
  for (const row of rows) {
    if (row.productName.trim() === "" || row.sku.trim() === "") {
      failed.push({ row: row.rowNumber, message: "product_name and sku are required." });
      continue;
    }
    const existingMatch = database.products.flatMap((product) => product.variants.map((variant) => ({ product, variant }))).find(({ variant }) => variant.sku.toLowerCase() === row.sku.trim().toLowerCase());
    if (!existingMatch) {
      const groupKey = row.productName.trim().toLowerCase();
      newProductGroups.set(groupKey, [...(newProductGroups.get(groupKey) ?? []), row]);
      continue;
    }
    const priceMinor = convertMajorInputToMinorUnits(row.price, currency);
    const costPriceMinor = parseOptionalMinor(row.costPrice, currency);
    if (priceMinor === null || costPriceMinor === "invalid") {
      failed.push({ row: row.rowNumber, message: "Price and cost price must be numbers." });
      continue;
    }
    const { product, variant } = existingMatch;
    replaceMockProduct({
      ...product,
      updatedAt: new Date().toISOString(),
      variants: product.variants.map((candidate) => candidate.id === variant.id
        ? { ...candidate, price: { amountMinor: priceMinor, currency }, costPrice: costPriceMinor === null ? candidate.costPrice : { amountMinor: costPriceMinor, currency }, lowStockThreshold: row.lowStockThreshold.trim() === "" ? candidate.lowStockThreshold : Math.max(0, Math.floor(Number(row.lowStockThreshold)) || 0) }
        : candidate),
    });
    updated += 1;
  }
  for (const groupRows of newProductGroups.values()) {
    const firstRow = groupRows[0];
    if (!firstRow) continue;
    const failGroup = (message: string) => groupRows.forEach((row) => failed.push({ row: row.rowNumber, message }));
    if (database.products.some((product) => product.name.toLowerCase() === firstRow.productName.trim().toLowerCase())) {
      failGroup("A product with this name already exists. Use its SKUs to update it, or rename the new product.");
      continue;
    }
    const category = firstRow.categoryName.trim() ? database.categories.find((candidate) => candidate.name.toLowerCase() === firstRow.categoryName.trim().toLowerCase()) : null;
    if (category === undefined) {
      failGroup(`Category "${firstRow.categoryName}" does not exist in your store.`);
      continue;
    }
    const variantRequests = groupRows.map((row) => convertRowToVariantRequest(row, currency, locationId));
    const variantError = variantRequests.find((variant): variant is string => typeof variant === "string");
    if (variantError) {
      failGroup(variantError);
      continue;
    }
    const optionNames = [firstRow.option1Name.trim(), firstRow.option2Name.trim()].filter(Boolean);
    const productRequest = {
      name: firstRow.productName, description: firstRow.description, categoryId: category?.id ?? null, status: "active" as const,
      taxable: readYesNoCell(firstRow.taxable, true), trackInventory: true, publishedOnline: false, tags: [], imageMediaIds: [],
      options: optionNames.map((optionName, optionIndex) => ({ name: optionName, values: [...new Set(groupRows.map((row) => (optionIndex === 0 ? row.option1Value : row.option2Value).trim()))] })),
      variants: variantRequests as ProductVariantUpsertRequest[],
    };
    const issues = validateProductRequestAgainstStore(productRequest, null);
    if (issues.length > 0) {
      failGroup(issues[0]?.message ?? "This product is not valid.");
      continue;
    }
    replaceMockProduct(buildMockProductFromRequest(productRequest, null));
    created += 1;
  }
  return { created, updated, failed: failed.sort((first, second) => first.row - second.row) };
}

export function registerProductImportExportMockRoutes(): void {
  registerMockRoute("GET", "/seller/products/export", (request) => {
    requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const locationId = request.query.get("locationId");
    const rows = database.products.filter((product) => product.status !== "archived").flatMap((product) => product.variants.map((variant) => {
      const optionEntries = product.options.map((option) => [option.name, variant.optionValues[option.name] ?? ""] as const);
      const cellsByField: Record<string, string> = {
        productName: product.name, description: product.description, categoryName: product.categoryName ?? "",
        option1Name: optionEntries[0]?.[0] ?? "", option1Value: optionEntries[0]?.[1] ?? "", option2Name: optionEntries[1]?.[0] ?? "", option2Value: optionEntries[1]?.[1] ?? "",
        sku: variant.sku, barcode: variant.barcode ?? "", price: convertMinorUnitsToMajorInputText(variant.price.amountMinor, variant.price.currency),
        compareAtPrice: variant.compareAtPrice ? convertMinorUnitsToMajorInputText(variant.compareAtPrice.amountMinor, variant.compareAtPrice.currency) : "",
        costPrice: variant.costPrice ? convertMinorUnitsToMajorInputText(variant.costPrice.amountMinor, variant.costPrice.currency) : "",
        lowStockThreshold: String(variant.lowStockThreshold),
        openingStock: String(variant.stock.filter((level) => !locationId || level.locationId === locationId).reduce((sum, level) => sum + level.onHand, 0)),
        taxable: product.taxable ? "yes" : "no", publishedOnline: product.publishedOnline ? "yes" : "no",
      };
      return productCsvColumns.map((column) => cellsByField[column.field] ?? "");
    }));
    return respondWithCsv("products.csv", convertRowsToCsvText(productCsvColumns.map((column) => column.header), rows));
  });

  registerMockRoute("POST", "/seller/products/import", (request) => runOnceForIdempotencyKey(request, () => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const locationId = String(body.locationId ?? "");
    if (!readMockDatabase().locations.some((location) => location.id === locationId)) throw new MockHttpError(400, "INVALID_LOCATION", "Choose the location that receives opening stock.");
    const result = importProductRows(readImportRows(body.rows), locationId);
    recordCatalogAuditEntry(principal, "product.imported", "product", null, `Imported products from CSV: ${result.created} created, ${result.updated} updated, ${result.failed.length} failed`);
    return respondWithJson(200, result);
  }));
}
