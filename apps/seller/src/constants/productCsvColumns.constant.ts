import type { ProductImportRow } from "@/types/productRequests.type";

export type ProductImportField = Exclude<keyof ProductImportRow, "rowNumber">;

export const productCsvColumns: readonly { readonly header: string; readonly field: ProductImportField; readonly required: boolean; readonly example: string }[] = [
  { header: "product_name", field: "productName", required: true, example: "Adire Oxford Shirt" },
  { header: "description", field: "description", required: false, example: "Hand-dyed adire panels on cotton." },
  { header: "category", field: "categoryName", required: false, example: "Fashion" },
  { header: "option1_name", field: "option1Name", required: false, example: "Size" },
  { header: "option1_value", field: "option1Value", required: false, example: "M" },
  { header: "option2_name", field: "option2Name", required: false, example: "Colour" },
  { header: "option2_value", field: "option2Value", required: false, example: "Indigo" },
  { header: "sku", field: "sku", required: true, example: "IFE-FAS-100-M-IND" },
  { header: "barcode", field: "barcode", required: false, example: "" },
  { header: "price", field: "price", required: true, example: "18500.00" },
  { header: "compare_at_price", field: "compareAtPrice", required: false, example: "" },
  { header: "cost_price", field: "costPrice", required: false, example: "9800.00" },
  { header: "low_stock_threshold", field: "lowStockThreshold", required: false, example: "5" },
  { header: "opening_stock", field: "openingStock", required: false, example: "10" },
  { header: "taxable", field: "taxable", required: false, example: "yes" },
  { header: "published_online", field: "publishedOnline", required: false, example: "no" },
];

export function readYesNoCell(cellText: string, defaultValue: boolean): boolean {
  const normalised = cellText.trim().toLowerCase();
  if (normalised === "") return defaultValue;
  return ["yes", "y", "true", "1"].includes(normalised);
}
