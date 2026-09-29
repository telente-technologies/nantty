import type { ProductBrandRelationship } from "@/types/brand.type";
import type { Product, ProductImage, ProductStatus, StockLevel } from "@/types/catalog.type";
import type { CurrencyCode } from "@/types/money.type";
import type { ProductUpsertRequest, ProductVariantUpsertRequest } from "@/types/productRequests.type";
import type { ValidationIssue } from "@/utils/formValidation.util";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";
import { buildVariantTitleFromOptionValues } from "@/utils/productValidation.util";

export interface OptionDraft {
  readonly key: string;
  readonly name: string;
  readonly valuesText: string;
}

export interface VariantDraft {
  readonly key: string;
  readonly id: string | null;
  readonly optionValues: Record<string, string>;
  readonly sku: string;
  readonly barcode: string;
  readonly priceText: string;
  readonly compareAtText: string;
  readonly costText: string;
  readonly lowStockThresholdText: string;
  readonly openingStockTextByLocationId: Record<string, string>;
  readonly stock: StockLevel[];
}

export interface ProductDraft {
  readonly name: string;
  readonly description: string;
  readonly categoryId: string;
  readonly status: ProductStatus;
  readonly taxable: boolean;
  readonly trackInventory: boolean;
  readonly publishedOnline: boolean;
  readonly tagsText: string;
  readonly options: OptionDraft[];
  readonly variants: VariantDraft[];
  readonly images: ProductImage[];
  readonly brandId: string;
  readonly brandRelationship: ProductBrandRelationship | "";
}

let draftKeyCounter = 0;
export function createDraftKey(): string {
  draftKeyCounter += 1;
  return `draft_${draftKeyCounter}`;
}

export function splitOptionValuesText(valuesText: string): string[] {
  return [...new Set(valuesText.split(",").map((value) => value.trim()).filter(Boolean))];
}

function createEmptyVariantDraft(optionValues: Record<string, string>, template: VariantDraft | undefined): VariantDraft {
  return {
    key: createDraftKey(), id: null, optionValues, sku: "", barcode: "",
    priceText: template?.priceText ?? "", compareAtText: template?.compareAtText ?? "", costText: template?.costText ?? "",
    lowStockThresholdText: template?.lowStockThresholdText ?? "5", openingStockTextByLocationId: {}, stock: [],
  };
}

export function createEmptyProductDraft(): ProductDraft {
  return {
    name: "", description: "", categoryId: "", status: "active", taxable: true, trackInventory: true, publishedOnline: false, tagsText: "",
    options: [], variants: [createEmptyVariantDraft({}, undefined)], images: [], brandId: "", brandRelationship: "",
  };
}

export function convertProductToDraft(product: Product): ProductDraft {
  const toText = (amountMinor: number | undefined, currency: CurrencyCode | undefined) => (amountMinor === undefined || !currency ? "" : convertMinorUnitsToMajorInputText(amountMinor, currency));
  return {
    name: product.name, description: product.description, categoryId: product.categoryId ?? "", status: product.status, taxable: product.taxable,
    trackInventory: product.trackInventory, publishedOnline: product.publishedOnline, tagsText: product.tags.join(", "),
    options: product.options.map((option) => ({ key: createDraftKey(), name: option.name, valuesText: option.values.join(", ") })),
    images: product.images,
    brandId: product.brand?.brandId ?? "",
    brandRelationship: product.brand?.relationship ?? "",
    variants: product.variants.map((variant) => ({
      key: variant.id, id: variant.id, optionValues: variant.optionValues, sku: variant.sku, barcode: variant.barcode ?? "",
      priceText: toText(variant.price.amountMinor, variant.price.currency),
      compareAtText: toText(variant.compareAtPrice?.amountMinor, variant.compareAtPrice?.currency),
      costText: toText(variant.costPrice?.amountMinor, variant.costPrice?.currency),
      lowStockThresholdText: String(variant.lowStockThreshold), openingStockTextByLocationId: {}, stock: variant.stock,
    })),
  };
}

function buildCombinationKey(optionValues: Record<string, string>, optionNames: readonly string[]): string {
  return optionNames.map((optionName) => `${optionName}=${optionValues[optionName] ?? ""}`).join("|");
}

export function regenerateVariantDraftsForOptions(options: readonly OptionDraft[], currentVariants: readonly VariantDraft[]): VariantDraft[] {
  const usableOptions = options.map((option) => ({ name: option.name.trim(), values: splitOptionValuesText(option.valuesText) })).filter((option) => option.name && option.values.length > 0);
  const optionNames = usableOptions.map((option) => option.name);
  const combinations = usableOptions.reduce<Record<string, string>[]>((accumulated, option) => accumulated.flatMap((combination) => option.values.map((value) => ({ ...combination, [option.name]: value }))), [{}]);
  const existingByKey = new Map(currentVariants.map((variant) => [buildCombinationKey(variant.optionValues, optionNames), variant]));
  const template = currentVariants[0];
  return combinations.slice(0, 100).map((combination) => {
    const existing = existingByKey.get(buildCombinationKey(combination, optionNames));
    if (existing && Object.keys(existing.optionValues).length === optionNames.length) return existing;
    if (combinations.length === 1 && currentVariants.length === 1 && template) return { ...template, optionValues: combination };
    return createEmptyVariantDraft(combination, template);
  });
}

export function describeVariantDraftTitle(variant: VariantDraft, options: readonly OptionDraft[]): string {
  return buildVariantTitleFromOptionValues(variant.optionValues, options.map((option) => option.name.trim()));
}

function parseOptionalMoney(text: string, currency: CurrencyCode, label: string, path: string, issues: ValidationIssue[]): number | null {
  if (text.trim() === "") return null;
  const amountMinor = convertMajorInputToMinorUnits(text, currency);
  if (amountMinor === null) issues.push({ path, message: `${label} must be a number like 18500 or 18500.50.` });
  return amountMinor;
}

export function convertDraftToUpsertRequest(draft: ProductDraft, currency: CurrencyCode, isNewProduct: boolean): { request: ProductUpsertRequest; parseIssues: ValidationIssue[] } {
  const parseIssues: ValidationIssue[] = [];
  const variants: ProductVariantUpsertRequest[] = draft.variants.map((variant, index) => {
    const label = `Variant ${index + 1}`;
    const priceMinor = parseOptionalMoney(variant.priceText, currency, `${label} price`, `variants.${index}.priceMinor`, parseIssues);
    if (variant.priceText.trim() === "") parseIssues.push({ path: `variants.${index}.priceMinor`, message: `${label}: enter a price.` });
    const threshold = Number(variant.lowStockThresholdText || "0");
    return {
      id: variant.id,
      optionValues: variant.optionValues,
      sku: variant.sku.trim(),
      barcode: variant.barcode.trim() || null,
      priceMinor: priceMinor ?? -1,
      compareAtPriceMinor: parseOptionalMoney(variant.compareAtText, currency, `${label} compare-at price`, `variants.${index}.compareAtPriceMinor`, parseIssues),
      costPriceMinor: parseOptionalMoney(variant.costText, currency, `${label} cost price`, `variants.${index}.costPriceMinor`, parseIssues),
      lowStockThreshold: Number.isFinite(threshold) ? threshold : -1,
      openingStock: isNewProduct
        ? Object.entries(variant.openingStockTextByLocationId).filter(([, quantityText]) => quantityText.trim() !== "").map(([locationId, quantityText]) => ({ locationId, quantity: Number(quantityText) }))
        : [],
    };
  });
  return {
    parseIssues,
    request: {
      name: draft.name,
      description: draft.description,
      categoryId: draft.categoryId || null,
      status: draft.status,
      taxable: draft.taxable,
      trackInventory: draft.trackInventory,
      publishedOnline: draft.publishedOnline,
      tags: draft.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      options: draft.options.map((option) => ({ name: option.name.trim(), values: splitOptionValuesText(option.valuesText) })).filter((option) => option.name || option.values.length > 0),
      imageMediaIds: draft.images.map((image) => image.mediaId),
      variants,
      brand: draft.brandId && draft.brandRelationship ? { brandId: draft.brandId, relationship: draft.brandRelationship } : null,
    },
  };
}
