import type { ProductFormValues } from "@/components/seller/productFormFields";
import type { Money } from "@/types/money.type";
import type { CatalogProduct, CatalogProductImage, CatalogProductUpsertRequest, CatalogProductVariant, CatalogVariantUpsertRequest, ProductBrandRelationship } from "@/types/sellerCatalog.type";
import { combinationKeyFor, createOptionGroupDraft, optionValueCombinations, projectExistingVariantsOntoOptions, usableOptionGroups, validateOptionGroups } from "@/utils/productOptions.util";

export const MAXIMUM_PRODUCT_IMAGES = 10;

export const EMPTY_PRODUCT_FORM: ProductFormValues = { name: "", description: "", priceInMajorUnits: "", stock: "", optionGroups: [] };
export const convertMajorUnitTextToMinorUnits = (value: string) => Math.round(Number.parseFloat(value || "0") * 100);

export interface ChosenBrand {
  readonly id: string;
  readonly name: string;
  readonly relationship?: ProductBrandRelationship;
}

export function totalAvailableStock(product: CatalogProduct): number {
  return product.variants.reduce((sum, variant) => sum + variant.stock.reduce((levels, level) => levels + level.onHand - level.reserved, 0), 0);
}

export function lowestVariantPrice(product: CatalogProduct): Money | null {
  return product.variants.reduce<Money | null>((lowest, variant) => (lowest === null || variant.price.amountMinor < lowest.amountMinor ? variant.price : lowest), null);
}

export function summariseProductForInventory(product: CatalogProduct, fallbackCurrency: Money["currency"]) {
  return { name: product.name, imageUrl: product.images[0]?.url ?? null, price: lowestVariantPrice(product) ?? { amountMinor: 0, currency: fallbackCurrency }, stock: totalAvailableStock(product) };
}

export function formValuesFromCatalogProduct(product: CatalogProduct): ProductFormValues {
  const price = lowestVariantPrice(product);
  return {
    name: product.name,
    description: product.description,
    priceInMajorUnits: price ? (price.amountMinor / 100).toFixed(2) : "",
    stock: String(totalAvailableStock(product)),
    optionGroups: product.options.map((option) => createOptionGroupDraft(option.name, option.values, option.name)),
  };
}

export function buildProductOptions(form: ProductFormValues): { name: string; values: string[] }[] {
  return usableOptionGroups(form.optionGroups);
}

export function matchExistingVariants(form: ProductFormValues, existing: CatalogProduct | null): { combination: Record<string, string>; match: CatalogProductVariant | undefined }[] {
  const projected = projectExistingVariantsOntoOptions(existing?.variants ?? [], form.optionGroups);
  return optionValueCombinations(buildProductOptions(form)).map((combination) => ({ combination, match: projected.get(combinationKeyFor(combination, form.optionGroups)) }));
}

export function variantsRemovedWithStock(form: ProductFormValues, existing: CatalogProduct | null): CatalogProductVariant[] {
  if (!existing) return [];
  const kept = new Set(matchExistingVariants(form, existing).map((row) => row.match?.id).filter(Boolean));
  return existing.variants.filter((variant) => !kept.has(variant.id) && variant.stock.some((level) => level.onHand !== 0));
}

export function validateProductForm(form: ProductFormValues, images: readonly CatalogProductImage[], isNewProduct: boolean): string | null {
  const name = form.name.trim();
  if (name.length < 2 || name.length > 120) return "Give your product a name of 2 to 120 characters.";
  if (!(convertMajorUnitTextToMinorUnits(form.priceInMajorUnits) > 0)) return "Enter a price above zero.";
  if (isNewProduct && !/^\d+$/.test(form.stock)) return "Enter how many you have in stock.";
  if (images.length > MAXIMUM_PRODUCT_IMAGES) return `You can add up to ${MAXIMUM_PRODUCT_IMAGES} photos.`;
  const optionsMessage = validateOptionGroups(form.optionGroups);
  if (optionsMessage) return optionsMessage;
  return null;
}

export function describeVariantsBlockedByStock(form: ProductFormValues, existing: CatalogProduct | null): string | null {
  const blocked = variantsRemovedWithStock(form, existing);
  if (blocked.length === 0) return null;
  const names = blocked.slice(0, 2).map((variant) => variant.title).join(", ");
  return `${names}${blocked.length > 2 ? ` and ${blocked.length - 2} more` : ""} still ${blocked.length === 1 ? "has" : "have"} stock. Set stock to 0 in your inventory before removing ${blocked.length === 1 ? "it" : "them"}.`;
}

const generatedSku = (seed: string, index: number) => `ZM-${seed}-${index + 1}`.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);

export function buildCatalogProductUpsertRequest(input: {
  readonly form: ProductFormValues;
  readonly images: readonly CatalogProductImage[];
  readonly brand: ChosenBrand | null;
  readonly existing: CatalogProduct | null;
  readonly defaultLocationId: string | null;
  readonly skuSeed: string;
}): CatalogProductUpsertRequest {
  const { form, images, brand, existing, defaultLocationId, skuSeed } = input;
  const options = buildProductOptions(form);
  const priceMinor = convertMajorUnitTextToMinorUnits(form.priceInMajorUnits);
  const quantity = Number.parseInt(form.stock || "0", 10);
  const variants: CatalogVariantUpsertRequest[] = matchExistingVariants(form, existing).map(({ combination: optionValues, match: matching }, index) => {
    return {
      id: matching?.id ?? null,
      optionValues,
      sku: matching?.sku ?? generatedSku(skuSeed, index),
      barcode: matching?.barcode ?? null,
      priceMinor,
      compareAtPriceMinor: matching?.compareAtPrice && matching.compareAtPrice.amountMinor > priceMinor ? matching.compareAtPrice.amountMinor : null,
      costPriceMinor: matching?.costPrice?.amountMinor ?? null,
      lowStockThreshold: matching?.lowStockThreshold ?? 5,
      openingStock: existing === null && defaultLocationId !== null && quantity > 0 ? [{ locationId: defaultLocationId, quantity }] : [],
    };
  });
  const keptRelationship = existing?.brand && brand && existing.brand.brandId === brand.id ? existing.brand.relationship : undefined;
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    categoryId: existing?.categoryId ?? null,
    status: existing?.status ?? "active",
    taxable: existing?.taxable ?? true,
    trackInventory: existing?.trackInventory ?? true,
    publishedOnline: existing?.publishedOnline ?? true,
    tags: [...(existing?.tags ?? [])],
    options,
    imageMediaIds: images.map((image) => image.mediaId),
    variants,
    brand: brand ? { brandId: brand.id, relationship: brand.relationship ?? keptRelationship ?? "genuine_resale" } : null,
  };
}

export function describeOptionRemovalImpact(current: ProductFormValues, next: ProductFormValues, existing: CatalogProduct | null): string | null {
  if (!existing) return null;
  const keptIds = (form: ProductFormValues) => new Set(matchExistingVariants(form, existing).map((row) => row.match?.id).filter((id): id is string => Boolean(id)));
  const before = keptIds(current);
  const after = keptIds(next);
  const dropped = existing.variants.filter((variant) => before.has(variant.id) && !after.has(variant.id));
  if (dropped.length === 0) return null;
  const onHand = dropped.reduce((sum, variant) => sum + variant.stock.reduce((levels, level) => levels + level.onHand, 0), 0);
  const names = dropped.slice(0, 3).map((variant) => variant.title).join(", ");
  const subject = dropped.length === 1 ? `The saved variant ${names} will be deleted` : `${dropped.length} saved variants (${names}${dropped.length > 3 ? ", …" : ""}) will be deleted`;
  return onHand !== 0
    ? `${subject} when you save. ${onHand} ${onHand === 1 ? "unit is" : "units are"} still in stock, so set stock to 0 in your inventory first or saving will be blocked.`
    : `${subject} when you save.`;
}
