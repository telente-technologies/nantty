import type { ProductBrandRelationship } from "@/types/brand.type";
import type { Product, ProductImage, ProductStatus, ProductVisibility, StockLevel } from "@/types/catalog.type";
import type { CurrencyCode } from "@/types/money.type";
import type { ProductUpsertRequest, ProductVariantUpsertRequest, RegionalPriceRequest } from "@/types/productRequests.type";
import type { ValidationIssue } from "@/utils/formValidation.util";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";
import { buildVariantTitleFromOptionValues } from "@/utils/productValidation.util";

export interface OptionDraft {
  readonly key: string;
  readonly name: string;
  readonly values: readonly string[];
  readonly pendingText: string;
  readonly appliedName: string | null;
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
  readonly regionalPriceTextByCurrency: Record<string, string>;
  readonly lowStockThresholdText: string;
  readonly openingStockTextByLocationId: Record<string, string>;
  readonly stock: StockLevel[];
  readonly reorderPoint: number | null;
  readonly reorderQuantity: number | null;
}

export interface AttributeDraft {
  readonly key: string;
  readonly name: string;
  readonly value: string;
}

export interface VideoDraft {
  readonly key: string;
  readonly url: string;
  readonly title: string;
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
  readonly visibility: ProductVisibility;
  readonly publishAtLocalText: string;
  readonly attributes: AttributeDraft[];
  readonly videos: VideoDraft[];
  readonly supplierId: string;
  readonly weightGramsText: string;
  readonly lengthMmText: string;
  readonly widthMmText: string;
  readonly heightMmText: string;
  readonly packageCategory: string;
  readonly packageCountText: string;
  readonly fragile: boolean;
  readonly contentsDescription: string;
  readonly declaredValueText: string;
}

function convertIsoToLocalDateTimeInputText(isoDate: string | null): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function convertLocalDateTimeInputTextToIso(localText: string): string | null {
  if (!localText) return null;
  const date = new Date(localText);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

let draftKeyCounter = 0;
export function createDraftKey(): string {
  draftKeyCounter += 1;
  return `draft_${draftKeyCounter}`;
}

export function createOptionDraft(name: string, values: readonly string[] = [], appliedName: string | null = null): OptionDraft {
  return { key: createDraftKey(), name, values: [...values], pendingText: "", appliedName };
}

function createEmptyVariantDraft(optionValues: Record<string, string>, template: VariantDraft | undefined): VariantDraft {
  return {
    key: createDraftKey(), id: null, optionValues, sku: "", barcode: "",
    priceText: template?.priceText ?? "", compareAtText: template?.compareAtText ?? "", costText: template?.costText ?? "", regionalPriceTextByCurrency: { ...(template?.regionalPriceTextByCurrency ?? {}) },
    lowStockThresholdText: template?.lowStockThresholdText ?? "5", openingStockTextByLocationId: {}, stock: [],
    reorderPoint: template?.reorderPoint ?? null, reorderQuantity: template?.reorderQuantity ?? null,
  };
}

export function createEmptyProductDraft(): ProductDraft {
  return {
    name: "", description: "", categoryId: "", status: "active", taxable: true, trackInventory: true, publishedOnline: false, tagsText: "",
    options: [], variants: [createEmptyVariantDraft({}, undefined)], images: [], brandId: "", brandRelationship: "",
    visibility: "public", publishAtLocalText: "", attributes: [], videos: [], supplierId: "",
    weightGramsText: "", lengthMmText: "", widthMmText: "", heightMmText: "", packageCategory: "general", packageCountText: "1",
    fragile: false, contentsDescription: "", declaredValueText: "",
  };
}

export function convertProductToDraft(product: Product): ProductDraft {
  const toText = (amountMinor: number | null | undefined, currency: CurrencyCode | undefined) => (amountMinor === undefined || amountMinor === null || !currency ? "" : convertMinorUnitsToMajorInputText(amountMinor, currency));
  const currency = product.variants[0]?.price.currency;
  return {
    name: product.name, description: product.description, categoryId: product.categoryId ?? "", status: product.status, taxable: product.taxable,
    trackInventory: product.trackInventory, publishedOnline: product.publishedOnline, tagsText: product.tags.join(", "),
    options: product.options.map((option) => createOptionDraft(option.name, option.values, option.name)),
    images: product.images,
    brandId: product.brand?.brandId ?? "",
    brandRelationship: product.brand?.relationship ?? "",
    visibility: product.visibility,
    publishAtLocalText: convertIsoToLocalDateTimeInputText(product.publishAt),
    attributes: product.attributes.map((attribute) => ({ key: createDraftKey(), name: attribute.name, value: attribute.value })),
    videos: product.videos.map((video) => ({ key: video.id, url: video.url, title: video.title })),
    supplierId: product.supplierId ?? "",
    weightGramsText: product.weightGrams === null || product.weightGrams === undefined ? "" : String(product.weightGrams),
    lengthMmText: product.lengthMm === null || product.lengthMm === undefined ? "" : String(product.lengthMm),
    widthMmText: product.widthMm === null || product.widthMm === undefined ? "" : String(product.widthMm),
    heightMmText: product.heightMm === null || product.heightMm === undefined ? "" : String(product.heightMm),
    packageCategory: product.packageCategory ?? "general",
    packageCountText: String(product.packageCount ?? 1),
    fragile: product.fragile ?? false,
    contentsDescription: product.contentsDescription ?? "",
    declaredValueText: toText(product.declaredValueMinor ?? undefined, currency),
    variants: product.variants.map((variant) => ({
      key: variant.id, id: variant.id, optionValues: variant.optionValues, sku: variant.sku, barcode: variant.barcode ?? "",
      priceText: toText(variant.price.amountMinor, variant.price.currency),
      compareAtText: toText(variant.compareAtPrice?.amountMinor, variant.compareAtPrice?.currency),
      costText: toText(variant.costPrice?.amountMinor, variant.costPrice?.currency),
      regionalPriceTextByCurrency: Object.fromEntries((variant.regionalPrices ?? []).map((price) => [price.currency, convertMinorUnitsToMajorInputText(price.priceMinor, price.currency)])),
      lowStockThresholdText: String(variant.lowStockThreshold), openingStockTextByLocationId: {}, stock: variant.stock,
      reorderPoint: variant.reorderPoint, reorderQuantity: variant.reorderQuantity,
    })),
  };
}

function buildCombinationKey(optionValues: Record<string, string>, optionNames: readonly string[]): string {
  return optionNames.map((optionName) => `${optionName}=${optionValues[optionName] ?? ""}`).join("|");
}

function usableOptions(options: readonly OptionDraft[]) {
  return options.map((option) => ({ key: option.key, name: option.name.trim(), values: [...option.values], appliedName: option.appliedName })).filter((option) => option.name && option.values.length > 0);
}

function projectVariantOntoOptions(variant: VariantDraft, nextOptions: ReturnType<typeof usableOptions>): Record<string, string> | null {
  const projected: Record<string, string> = {};
  for (const option of nextOptions) {
    const value = (option.appliedName ? variant.optionValues[option.appliedName] : undefined) ?? option.values[0];
    if (value === undefined || !option.values.includes(value)) return null;
    projected[option.name] = value;
  }
  return projected;
}

export function applyOptionChanges(nextOptions: readonly OptionDraft[], currentVariants: readonly VariantDraft[]): { options: OptionDraft[]; variants: VariantDraft[] } {
  const names = nextOptions.map((option) => option.name.trim().toLocaleLowerCase()).filter(Boolean);
  const isMidEdit = nextOptions.some((option) => !option.name.trim() && option.values.length > 0) || new Set(names).size !== names.length;
  if (isMidEdit) return { options: [...nextOptions], variants: [...currentVariants] };
  const variants = regenerateVariantDraftsForOptions(nextOptions, currentVariants);
  return { options: nextOptions.map((option) => (option.name.trim() ? { ...option, appliedName: option.name.trim() } : option)), variants };
}

export function regenerateVariantDraftsForOptions(nextOptions: readonly OptionDraft[], currentVariants: readonly VariantDraft[]): VariantDraft[] {
  const options = usableOptions(nextOptions);
  const optionNames = options.map((option) => option.name);
  const combinations = options.reduce<Record<string, string>[]>((accumulated, option) => accumulated.flatMap((combination) => option.values.map((value) => ({ ...combination, [option.name]: value }))), [{}]);
  const projectedByKey = new Map<string, VariantDraft>();
  for (const variant of currentVariants) {
    const projected = projectVariantOntoOptions(variant, options);
    const combinationKey = projected ? buildCombinationKey(projected, optionNames) : null;
    if (combinationKey !== null && !projectedByKey.has(combinationKey)) projectedByKey.set(combinationKey, { ...variant, optionValues: projected! });
  }
  const template = currentVariants[0];
  return combinations.slice(0, 100).map((combination) => projectedByKey.get(buildCombinationKey(combination, optionNames)) ?? createEmptyVariantDraft(combination, template));
}

export function variantDraftHasStock(variant: VariantDraft): boolean {
  return variant.stock.some((level) => level.onHand !== 0) || Object.values(variant.openingStockTextByLocationId).some((quantity) => Number(quantity) > 0);
}

export function findDroppedVariantDrafts(currentVariants: readonly VariantDraft[], nextVariants: readonly VariantDraft[]): VariantDraft[] {
  const keptKeys = new Set(nextVariants.map((variant) => variant.key));
  return currentVariants.filter((variant) => !keptKeys.has(variant.key));
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

function parseOptionalWholeNumber(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : -1;
}

function parseRegionalPrices(variant: VariantDraft, storeCurrency: CurrencyCode, index: number, issues: ValidationIssue[]): RegionalPriceRequest[] {
  const prices: RegionalPriceRequest[] = [];
  for (const [marketCurrency, text] of Object.entries(variant.regionalPriceTextByCurrency)) {
    if (text.trim() === "" || marketCurrency === storeCurrency) continue;
    const priceMinor = convertMajorInputToMinorUnits(text, marketCurrency as CurrencyCode);
    if (priceMinor === null || priceMinor < 1) issues.push({ path: `variants.${index}.regionalPrices.${marketCurrency}`, message: `Variant ${index + 1}: the ${marketCurrency} price must be a number above zero.` });
    else prices.push({ currency: marketCurrency as CurrencyCode, priceMinor });
  }
  return prices;
}

export function convertDraftToUpsertRequest(draft: ProductDraft, currency: CurrencyCode, isNewProduct: boolean): { request: ProductUpsertRequest; parseIssues: ValidationIssue[] } {
  const parseIssues: ValidationIssue[] = [];
  const weightGrams = parseOptionalWholeNumber(draft.weightGramsText);
  const lengthMm = parseOptionalWholeNumber(draft.lengthMmText);
  const widthMm = parseOptionalWholeNumber(draft.widthMmText);
  const heightMm = parseOptionalWholeNumber(draft.heightMmText);
  const packageCount = draft.packageCountText.trim() === "" ? 1 : parseOptionalWholeNumber(draft.packageCountText) ?? -1;
  const declaredValueMinor = parseOptionalMoney(draft.declaredValueText, currency, "Declared value", "declaredValueMinor", parseIssues);
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
      regionalPrices: parseRegionalPrices(variant, currency, index, parseIssues),
      lowStockThreshold: Number.isFinite(threshold) ? threshold : -1,
      ...(variant.reorderPoint !== null ? { reorderPoint: variant.reorderPoint } : {}),
      ...(variant.reorderQuantity !== null ? { reorderQuantity: variant.reorderQuantity } : {}),
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
      options: draft.options.map((option) => ({ name: option.name.trim(), values: [...option.values] })).filter((option) => option.name || option.values.length > 0),
      imageMediaIds: draft.images.map((image) => image.mediaId),
      variants,
      brand: draft.brandId && draft.brandRelationship ? { brandId: draft.brandId, relationship: draft.brandRelationship } : null,
      visibility: draft.visibility,
      publishAt: draft.status === "draft" ? convertLocalDateTimeInputTextToIso(draft.publishAtLocalText) : null,
      attributes: draft.attributes.filter((attribute) => attribute.name.trim() || attribute.value.trim()).map((attribute) => ({ name: attribute.name.trim(), value: attribute.value.trim() })),
      videos: draft.videos.filter((video) => video.url.trim()).map((video) => ({ url: video.url.trim(), title: video.title.trim() })),
      supplierId: draft.supplierId || null,
      weightGrams,
      lengthMm,
      widthMm,
      heightMm,
      packageCategory: draft.packageCategory.trim() || "general",
      packageCount,
      fragile: draft.fragile,
      contentsDescription: draft.contentsDescription.trim(),
      declaredValueMinor,
    },
  };
}
