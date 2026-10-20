import type { ProductStatus, ProductVisibility } from "@/types/catalog.type";
import { supportedCurrencyCodes } from "@/constants/currency.constant";
import type { ProductUpsertRequest, ProductVariantUpsertRequest } from "@/types/productRequests.type";
import type { ValidationIssue } from "@/utils/formValidation.util";
import { isValidEan13 } from "@/utils/ean13.util";

export const productStatuses: readonly ProductStatus[] = ["draft", "active", "archived"];
export const skuPattern = /^[A-Za-z0-9._-]{1,64}$/;
export const maximumMoneyMinor = 1_000_000_000_000;
export const maximumVariantsPerProduct = 100;
export const productVisibilities: readonly ProductVisibility[] = ["public", "store_only", "link_only"];
export const maximumProductAttributes = 20;
export const maximumProductVideos = 3;
export const maximumParcelWeightGrams = 1_000_000;
export const maximumParcelDimensionMm = 10_000;
export const maximumPackageCount = 1_000;
export const maximumContentsDescriptionLength = 300;

export function isHttpsVideoUrl(candidate: string): boolean {
  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === "https:" && candidate.length <= 500;
  } catch {
    return false;
  }
}

export interface ProductValidationContext {
  readonly categoryIds: readonly string[] | null;
  readonly locationIds: readonly string[] | null;
  readonly skusUsedByOtherProducts: ReadonlySet<string>;
  readonly barcodesUsedByOtherProducts: ReadonlySet<string>;
  readonly supplierIds?: readonly string[] | null;
}

function validateProductMerchandisingFields(request: ProductUpsertRequest, context: ProductValidationContext, addIssue: (path: string, message: string) => void): void {
  if (request.visibility !== undefined && !productVisibilities.includes(request.visibility)) addIssue("visibility", "Choose who can see this product.");
  if (request.publishAt) {
    const publishTime = new Date(request.publishAt).getTime();
    if (Number.isNaN(publishTime)) addIssue("publishAt", "Pick a valid date and time to publish.");
    else if (request.status !== "draft") addIssue("publishAt", "Only drafts can be scheduled. Set the status to draft.");
    else if (publishTime > Date.now() + 366 * 86_400_000) addIssue("publishAt", "Schedule publishing within the next 12 months.");
  }
  const attributes = request.attributes ?? [];
  if (!Array.isArray(attributes) || attributes.length > maximumProductAttributes) addIssue("attributes", `Use up to ${maximumProductAttributes} attributes.`);
  else attributes.forEach((attribute, index) => {
    if (typeof attribute.name !== "string" || attribute.name.trim().length < 1 || attribute.name.length > 40) addIssue(`attributes.${index}.name`, `Attribute ${index + 1}: name needs 1 to 40 characters.`);
    if (typeof attribute.value !== "string" || attribute.value.trim().length < 1 || attribute.value.length > 200) addIssue(`attributes.${index}.value`, `Attribute ${index + 1}: value needs 1 to 200 characters.`);
  });
  const videos = request.videos ?? [];
  if (!Array.isArray(videos) || videos.length > maximumProductVideos) addIssue("videos", `Add up to ${maximumProductVideos} videos.`);
  else videos.forEach((video, index) => {
    if (typeof video.url !== "string" || !isHttpsVideoUrl(video.url)) addIssue(`videos.${index}.url`, `Video ${index + 1}: use a full https:// link.`);
    if (typeof video.title !== "string" || video.title.length > 80) addIssue(`videos.${index}.title`, `Video ${index + 1}: title must be 80 characters or fewer.`);
  });
  if (request.supplierId && context.supplierIds && !context.supplierIds.includes(request.supplierId)) addIssue("supplierId", "Choose one of your suppliers.");
}

function validateRegionalPrices(prices: ProductVariantUpsertRequest["regionalPrices"], path: string, addIssue: (path: string, message: string) => void): void {
  if (prices === undefined) return;
  if (!Array.isArray(prices) || prices.length > supportedCurrencyCodes.length) {
    addIssue(`${path}.regionalPrices`, "Prices by country has too many entries.");
    return;
  }
  const seen = new Set<string>();
  prices.forEach((price) => {
    if (!supportedCurrencyCodes.includes(price.currency)) addIssue(`${path}.regionalPrices.${String(price.currency)}`, "Choose a supported country price currency.");
    else if (seen.has(price.currency)) addIssue(`${path}.regionalPrices.${price.currency}`, `The ${price.currency} price is set twice.`);
    seen.add(price.currency);
    if (!Number.isSafeInteger(price.priceMinor) || price.priceMinor < 1 || price.priceMinor > maximumMoneyMinor) addIssue(`${path}.regionalPrices.${String(price.currency)}`, `The ${String(price.currency)} price must be above zero.`);
  });
}

function isWholeMinorAmount(value: unknown, allowNull: boolean): boolean {
  if (value === null) return allowNull;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximumMoneyMinor;
}

function isOptionalWholeNumberInRange(value: unknown, minimum: number, maximum: number): boolean {
  return value === undefined || value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum);
}

interface ParcelMeasurementFields {
  readonly weightGrams?: number | null;
  readonly lengthMm?: number | null;
  readonly widthMm?: number | null;
  readonly heightMm?: number | null;
}

function validateParcelMeasurements(fields: ParcelMeasurementFields, path: string, label: string, addIssue: (path: string, message: string) => void): void {
  if (!isOptionalWholeNumberInRange(fields.weightGrams, 1, maximumParcelWeightGrams)) addIssue(`${path}weightGrams`, `${label}: weight must be a whole number of grams from 1 to 1,000,000.`);
  const dimensions = [
    { value: fields.lengthMm, path: `${path}lengthMm`, name: "Length" },
    { value: fields.widthMm, path: `${path}widthMm`, name: "Width" },
    { value: fields.heightMm, path: `${path}heightMm`, name: "Height" },
  ];
  const suppliedDimensions = dimensions.filter((dimension) => dimension.value !== undefined && dimension.value !== null).length;
  if (suppliedDimensions > 0 && suppliedDimensions < dimensions.length) addIssue(`${path}lengthMm`, `${label}: provide length, width and height together.`);
  for (const dimension of dimensions) {
    if (!isOptionalWholeNumberInRange(dimension.value, 1, maximumParcelDimensionMm)) addIssue(dimension.path, `${label}: ${dimension.name.toLowerCase()} must be a whole number of millimetres from 1 to 10,000.`);
  }
}

function validateProductParcelFields(request: ProductUpsertRequest, addIssue: (path: string, message: string) => void): void {
  validateParcelMeasurements(request, "", "Product", addIssue);
  if (request.packageCategory !== undefined && (typeof request.packageCategory !== "string" || request.packageCategory.trim().length < 1 || request.packageCategory.length > 40)) {
    addIssue("packageCategory", "Package type needs 1 to 40 characters.");
  }
  if (request.packageCount !== undefined && !isOptionalWholeNumberInRange(request.packageCount, 1, maximumPackageCount)) {
    addIssue("packageCount", "Packages must be a whole number from 1 to 1,000.");
  }
  if (request.fragile !== undefined && typeof request.fragile !== "boolean") addIssue("fragile", "Fragile must be on or off.");
  if (request.contentsDescription !== undefined && (typeof request.contentsDescription !== "string" || request.contentsDescription.length > maximumContentsDescriptionLength)) {
    addIssue("contentsDescription", `Package contents must be ${maximumContentsDescriptionLength} characters or fewer.`);
  }
  if (request.declaredValueMinor !== undefined && !isWholeMinorAmount(request.declaredValueMinor, true)) {
    addIssue("declaredValueMinor", "Declared value must be zero or more.");
  }
}

export function isBarcodeFormatAcceptable(barcode: string): boolean {
  if (!/^\d{8,14}$/.test(barcode)) return false;
  return barcode.length !== 13 || isValidEan13(barcode);
}

function buildOptionCombinationKey(optionValues: Record<string, string>, optionNames: readonly string[]): string {
  return optionNames.map((optionName) => optionValues[optionName] ?? "").join("\u0000");
}

export function validateProductUpsertRequest(request: ProductUpsertRequest, context: ProductValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const addIssue = (path: string, message: string) => issues.push({ path, message });
  const trimmedName = typeof request.name === "string" ? request.name.trim() : "";
  if (trimmedName.length < 2 || trimmedName.length > 120) addIssue("name", "Product name needs 2 to 120 characters.");
  if (typeof request.description !== "string" || request.description.length > 5000) addIssue("description", "Description must be 5,000 characters or fewer.");
  if (request.categoryId !== null && (typeof request.categoryId !== "string" || (context.categoryIds && !context.categoryIds.includes(request.categoryId)))) addIssue("categoryId", "Choose one of your categories.");
  if (!productStatuses.includes(request.status)) addIssue("status", "Choose a valid status.");
  for (const flagName of ["taxable", "trackInventory", "publishedOnline"] as const) {
    if (typeof request[flagName] !== "boolean") addIssue(flagName, `${flagName} must be on or off.`);
  }
  if (!Array.isArray(request.tags) || request.tags.length > 20 || request.tags.some((tag) => typeof tag !== "string" || tag.trim().length === 0 || tag.length > 30)) addIssue("tags", "Use up to 20 tags of 30 characters or fewer.");
  if (!Array.isArray(request.imageMediaIds) || request.imageMediaIds.length > 10) addIssue("imageMediaIds", "A product can have up to 10 images.");
  validateProductMerchandisingFields(request, context, addIssue);
  validateProductParcelFields(request, addIssue);

  const options = Array.isArray(request.options) ? request.options : [];
  if (options.length > 3) addIssue("options", "Use up to 3 options, such as Size and Colour.");
  const optionNames = options.map((option) => option.name?.trim() ?? "");
  options.forEach((option, optionIndex) => {
    const optionName = optionNames[optionIndex] ?? "";
    if (optionName.length < 1 || new TextEncoder().encode(optionName).length > 30) addIssue(`options.${optionIndex}.name`, "Option names need 1 to 30 characters.");
    const values = Array.isArray(option.values) ? option.values : [];
    if (values.length < 1 || values.length > 30) addIssue(`options.${optionIndex}.values`, `Give ${optionName || "this option"} between 1 and 30 values.`);
    if (new Set(values.map((value) => value.trim().toLowerCase())).size !== values.length) addIssue(`options.${optionIndex}.values`, `${optionName || "This option"} has repeated values.`);
    if (values.some((value) => value.trim().length === 0 || new TextEncoder().encode(value).length > 40)) addIssue(`options.${optionIndex}.values`, "Option values need 1 to 40 characters.");
  });
  if (new Set(optionNames.map((name) => name.toLowerCase())).size !== optionNames.length) addIssue("options", "Option names must be different from each other.");

  const variants = Array.isArray(request.variants) ? request.variants : [];
  if (variants.length < 1 || variants.length > maximumVariantsPerProduct) addIssue("variants", `A product needs between 1 and ${maximumVariantsPerProduct} variants.`);
  const seenSkus = new Set<string>();
  const seenBarcodes = new Set<string>();
  const seenCombinations = new Set<string>();
  variants.forEach((variant, variantIndex) => {
    const label = `Variant ${variantIndex + 1}`;
    const path = `variants.${variantIndex}`;
    const sku = typeof variant.sku === "string" ? variant.sku.trim() : "";
    if (!skuPattern.test(sku)) addIssue(`${path}.sku`, `${label}: SKU needs 1 to 64 letters, numbers, dots, dashes or underscores.`);
    else if (seenSkus.has(sku.toLowerCase())) addIssue(`${path}.sku`, `${label}: SKU ${sku} is used twice in this product.`);
    else if (context.skusUsedByOtherProducts.has(sku.toLowerCase())) addIssue(`${path}.sku`, `${label}: SKU ${sku} already belongs to another product.`);
    seenSkus.add(sku.toLowerCase());
    if (variant.barcode !== null) {
      if (typeof variant.barcode !== "string" || !isBarcodeFormatAcceptable(variant.barcode)) addIssue(`${path}.barcode`, `${label}: barcode must be 8 to 14 digits (EAN-13 check digit must be right).`);
      else if (seenBarcodes.has(variant.barcode)) addIssue(`${path}.barcode`, `${label}: barcode is used twice in this product.`);
      else if (context.barcodesUsedByOtherProducts.has(variant.barcode)) addIssue(`${path}.barcode`, `${label}: barcode already belongs to another product.`);
      seenBarcodes.add(String(variant.barcode));
    }
    if (!isWholeMinorAmount(variant.priceMinor, false)) addIssue(`${path}.priceMinor`, `${label}: enter a price of zero or more.`);
    if (!isWholeMinorAmount(variant.compareAtPriceMinor, true)) addIssue(`${path}.compareAtPriceMinor`, `${label}: compare-at price must be zero or more.`);
    else if (variant.compareAtPriceMinor !== null && variant.compareAtPriceMinor <= variant.priceMinor) addIssue(`${path}.compareAtPriceMinor`, `${label}: compare-at price must be higher than the price.`);
    validateRegionalPrices(variant.regionalPrices, path, addIssue);
    if (!isWholeMinorAmount(variant.costPriceMinor, true)) addIssue(`${path}.costPriceMinor`, `${label}: cost price must be zero or more.`);
    if (!Number.isSafeInteger(variant.lowStockThreshold) || variant.lowStockThreshold < 0 || variant.lowStockThreshold > 100_000) addIssue(`${path}.lowStockThreshold`, `${label}: low-stock alert must be a whole number from 0 to 100,000.`);
    for (const reorderField of ["reorderPoint", "reorderQuantity"] as const) {
      const reorderValue = variant[reorderField];
      if (reorderValue !== undefined && (!Number.isSafeInteger(reorderValue) || reorderValue < 0 || reorderValue > 1_000_000)) addIssue(`${path}.${reorderField}`, `${label}: reorder numbers must be whole numbers from 0 to 1,000,000.`);
    }
    validateParcelMeasurements(variant, `${path}.`, label, addIssue);
    const optionValues = variant.optionValues ?? {};
    const hasEveryOptionValue = options.every((option, optionIndex) => option.values.includes(optionValues[optionNames[optionIndex] ?? ""] ?? ""));
    if (!hasEveryOptionValue || Object.keys(optionValues).length !== options.length) addIssue(`${path}.optionValues`, `${label}: pick one value for each option.`);
    const combinationKey = buildOptionCombinationKey(optionValues, optionNames);
    if (seenCombinations.has(combinationKey)) addIssue(`${path}.optionValues`, `${label}: this option combination is listed twice.`);
    seenCombinations.add(combinationKey);
    const openingStock = Array.isArray(variant.openingStock) ? variant.openingStock : [];
    openingStock.forEach((entry) => {
      if (context.locationIds && !context.locationIds.includes(entry.locationId)) addIssue(`${path}.openingStock`, `${label}: opening stock uses an unknown location.`);
      if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 0 || entry.quantity > 1_000_000) addIssue(`${path}.openingStock`, `${label}: opening stock must be a whole number from 0 to 1,000,000.`);
    });
  });
  return issues;
}

export function calculateMarginBasisPoints(priceMinor: number | null, costMinor: number | null): number | null {
  if (priceMinor === null || costMinor === null || priceMinor <= 0) return null;
  return Math.round(((priceMinor - costMinor) * 10_000) / priceMinor);
}

export function buildVariantTitleFromOptionValues(optionValues: Record<string, string>, optionNames: readonly string[]): string {
  const orderedValues = optionNames.map((optionName) => optionValues[optionName]).filter((value): value is string => Boolean(value));
  return orderedValues.join(" / ") || "Default";
}
