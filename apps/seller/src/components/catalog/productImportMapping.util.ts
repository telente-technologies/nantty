import { productCsvColumns, type ProductImportField } from "@/constants/productCsvColumns.constant";
import type { CurrencyCode } from "@/types/money.type";
import type { ProductImportRow } from "@/types/productRequests.type";
import { convertMajorInputToMinorUnits } from "@/utils/money.util";
import { isBarcodeFormatAcceptable, skuPattern } from "@/utils/productValidation.util";

export type ColumnMapping = Record<ProductImportField, number | null>;

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function guessColumnMappingFromHeaders(headers: readonly string[]): ColumnMapping {
  const normalisedHeaders = headers.map(normaliseHeader);
  const mapping = {} as ColumnMapping;
  for (const column of productCsvColumns) {
    const aliases = [column.header, column.field.toLowerCase(), column.header.replace(/_/g, "")];
    const index = normalisedHeaders.findIndex((header) => aliases.includes(header) || aliases.includes(header.replace(/_/g, "")));
    mapping[column.field] = index === -1 ? null : index;
  }
  return mapping;
}

export function buildImportRowsFromCsv(dataRows: readonly string[][], mapping: ColumnMapping): ProductImportRow[] {
  return dataRows.map((cells, index) => {
    const read = (field: ProductImportField) => {
      const columnIndex = mapping[field];
      return columnIndex === null ? "" : (cells[columnIndex] ?? "").trim();
    };
    return {
      rowNumber: index + 2,
      productName: read("productName"), description: read("description"), categoryName: read("categoryName"),
      option1Name: read("option1Name"), option1Value: read("option1Value"), option2Name: read("option2Name"), option2Value: read("option2Value"),
      sku: read("sku"), barcode: read("barcode"), price: read("price"), compareAtPrice: read("compareAtPrice"), costPrice: read("costPrice"),
      lowStockThreshold: read("lowStockThreshold"), openingStock: read("openingStock"), taxable: read("taxable"), publishedOnline: read("publishedOnline"),
    };
  });
}

export function findImportRowProblems(row: ProductImportRow, currency: CurrencyCode): string[] {
  const problems: string[] = [];
  if (row.productName.length < 2 || row.productName.length > 120) problems.push("Product name needs 2 to 120 characters.");
  if (!skuPattern.test(row.sku)) problems.push("SKU is missing or has characters other than letters, numbers, dots, dashes and underscores.");
  if (convertMajorInputToMinorUnits(row.price, currency) === null) problems.push("Price must be a number.");
  for (const [label, value] of [["Compare-at price", row.compareAtPrice], ["Cost price", row.costPrice]] as const) {
    if (value !== "" && convertMajorInputToMinorUnits(value, currency) === null) problems.push(`${label} must be a number.`);
  }
  if (row.barcode !== "" && !isBarcodeFormatAcceptable(row.barcode)) problems.push("Barcode must be 8 to 14 digits with a valid check digit.");
  for (const [label, value] of [["Low-stock alert", row.lowStockThreshold], ["Opening stock", row.openingStock]] as const) {
    if (value !== "" && !/^\d{1,7}$/.test(value)) problems.push(`${label} must be a whole number.`);
  }
  if ((row.option1Name === "") !== (row.option1Value === "") || (row.option2Name === "") !== (row.option2Value === "")) problems.push("Each option needs both a name and a value.");
  return problems;
}
