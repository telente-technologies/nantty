import type { ProductFormValues } from "@/components/seller/productFormFields";
import type { Money } from "@/types/money.type";
import type { CatalogProduct, CatalogProductImage, CatalogProductUpsertRequest, CatalogVariantUpsertRequest, ProductBrandRelationship } from "@/types/sellerCatalog.type";

export const MAXIMUM_PRODUCT_IMAGES = 10;
const MAXIMUM_OPTIONS = 3;
const SIZE_OPTION = "Size";
const COLOR_OPTION = "Color";

export const EMPTY_PRODUCT_FORM: ProductFormValues = { name: "", description: "", priceInMajorUnits: "", stock: "", sizes: "", colors: "", variants: [] };

export const splitCommaSeparatedList = (value: string): string[] => [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))].slice(0, 30);
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
  const valuesOf = (name: string) => product.options.find((option) => option.name === name)?.values.join(", ") ?? "";
  const price = lowestVariantPrice(product);
  return {
    name: product.name,
    description: product.description,
    priceInMajorUnits: price ? (price.amountMinor / 100).toFixed(2) : "",
    stock: String(totalAvailableStock(product)),
    sizes: valuesOf(SIZE_OPTION),
    colors: valuesOf(COLOR_OPTION),
    variants: product.options.filter((option) => option.name !== SIZE_OPTION && option.name !== COLOR_OPTION).map((option) => ({ name: option.name, options: option.values.join(", ") })),
  };
}

export function buildProductOptions(form: ProductFormValues): { name: string; values: string[] }[] {
  const custom = form.variants.map((variant) => ({ name: variant.name.trim(), values: splitCommaSeparatedList(variant.options) }));
  return [{ name: SIZE_OPTION, values: splitCommaSeparatedList(form.sizes) }, { name: COLOR_OPTION, values: splitCommaSeparatedList(form.colors) }, ...custom]
    .filter((option) => option.name.length > 0 && option.values.length > 0)
    .filter((option, index, all) => all.findIndex((other) => other.name.toLowerCase() === option.name.toLowerCase()) === index);
}

export function validateProductForm(form: ProductFormValues, images: readonly CatalogProductImage[], isNewProduct: boolean): string | null {
  const name = form.name.trim();
  if (name.length < 2 || name.length > 120) return "Give your product a name of 2 to 120 characters.";
  if (!(convertMajorUnitTextToMinorUnits(form.priceInMajorUnits) > 0)) return "Enter a price above zero.";
  if (isNewProduct && !/^\d+$/.test(form.stock)) return "Enter how many you have in stock.";
  if (images.length > MAXIMUM_PRODUCT_IMAGES) return `You can add up to ${MAXIMUM_PRODUCT_IMAGES} photos.`;
  if (buildProductOptions(form).length > MAXIMUM_OPTIONS) return "A product can have up to 3 kinds of options, like size, colour and one more.";
  if (form.variants.some((variant) => variant.name.trim() !== "" && splitCommaSeparatedList(variant.options).length === 0)) return "Add options for each custom variant, or remove it.";
  return null;
}

const combinations = (options: readonly { readonly name: string; readonly values: readonly string[] }[]): Record<string, string>[] =>
  options.reduce<Record<string, string>[]>((rows, option) => rows.flatMap((row) => option.values.map((value) => ({ ...row, [option.name]: value }))), [{}]);

const sameOptionValues = (left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>) =>
  Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([name, value]) => right[name] === value);

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
  const variants: CatalogVariantUpsertRequest[] = combinations(options).map((optionValues, index) => {
    const matching = existing?.variants.find((variant) => sameOptionValues(variant.optionValues, optionValues));
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
