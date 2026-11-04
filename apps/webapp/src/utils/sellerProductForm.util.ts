import type { Money } from "@/types";
import type { CatalogProduct, CatalogProductImage, CatalogProductUpsertRequest, CatalogVariantUpsertRequest } from "@/types/sellerCatalog.type";

export const MAXIMUM_PRODUCT_IMAGES = 10;
const SIZE_OPTION = "Size";
const COLOR_OPTION = "Color";

export interface SellerProductFormValues {
  readonly name: string;
  readonly description: string;
  readonly priceText: string;
  readonly stockText: string;
  readonly sizesText: string;
  readonly colorsText: string;
  readonly images: readonly CatalogProductImage[];
}

export const EMPTY_SELLER_PRODUCT_FORM: SellerProductFormValues = { name: "", description: "", priceText: "", stockText: "1", sizesText: "", colorsText: "", images: [] };

export const splitCommaSeparatedList = (text: string): string[] => [...new Set(text.split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 30);

export function totalOnHandStock(product: CatalogProduct): number {
  return product.variants.reduce((sum, variant) => sum + variant.stock.reduce((levels, level) => levels + level.onHand - level.reserved, 0), 0);
}

export function lowestVariantPrice(product: CatalogProduct): Money | null {
  return product.variants.reduce<Money | null>((lowest, variant) => (lowest === null || variant.price.amountMinor < lowest.amountMinor ? variant.price : lowest), null);
}

export const isProductLive = (product: CatalogProduct) => product.status === "active" && product.publishedOnline;
export const hasConfirmedProductVisibility = (products: readonly CatalogProduct[], productId: string, published: boolean) => {
  const product = products.find((candidate) => candidate.id === productId);
  return product !== undefined && isProductLive(product) === published;
};

export function formValuesFromCatalogProduct(product: CatalogProduct): SellerProductFormValues {
  const optionValues = (name: string) => product.options.find((option) => option.name === name)?.values.join(", ") ?? "";
  const price = lowestVariantPrice(product);
  return {
    name: product.name,
    description: product.description,
    priceText: price ? (price.amountMinor / 100).toFixed(2) : "",
    stockText: String(totalOnHandStock(product)),
    sizesText: optionValues(SIZE_OPTION),
    colorsText: optionValues(COLOR_OPTION),
    images: product.images,
  };
}

export type SellerProductFormErrors = Partial<Record<"name" | "price" | "stock" | "images", string>>;

export function validateSellerProductForm(values: SellerProductFormValues, isNewProduct: boolean): SellerProductFormErrors {
  const errors: { -readonly [Key in keyof SellerProductFormErrors]: string } = {};
  const trimmedName = values.name.trim();
  if (trimmedName.length < 2) errors.name = "Give your product a name.";
  else if (trimmedName.length > 120) errors.name = "Keep the name under 120 characters.";
  const price = Number(values.priceText.trim());
  if (!values.priceText.trim() || !Number.isFinite(price) || price <= 0) errors.price = "Enter a valid price.";
  const stock = Number(values.stockText.trim());
  if (isNewProduct && (!/^\d+$/.test(values.stockText.trim()) || stock > 1_000_000)) errors.stock = "Enter a valid stock quantity.";
  if (values.images.length > MAXIMUM_PRODUCT_IMAGES) errors.images = `You can add up to ${MAXIMUM_PRODUCT_IMAGES} photos.`;
  return errors;
}

const combinations = (options: readonly { readonly name: string; readonly values: readonly string[] }[]): Record<string, string>[] =>
  options.reduce<Record<string, string>[]>((rows, option) => rows.flatMap((row) => option.values.map((value) => ({ ...row, [option.name]: value }))), [{}]);

const sameOptionValues = (left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>) =>
  Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([name, value]) => right[name] === value);

const generatedSku = (seed: string, index: number) => `ZM-${seed}-${index + 1}`.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);

export function buildCatalogProductUpsertRequest(values: SellerProductFormValues, existing: CatalogProduct | null, defaultLocationId: string | null, skuSeed: string): CatalogProductUpsertRequest {
  const options = [
    { name: SIZE_OPTION, values: splitCommaSeparatedList(values.sizesText) },
    { name: COLOR_OPTION, values: splitCommaSeparatedList(values.colorsText) },
  ].filter((option) => option.values.length > 0);
  const priceMinor = Math.round(Number(values.priceText.trim()) * 100);
  const quantity = Number.parseInt(values.stockText.trim(), 10);
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
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    categoryId: existing?.categoryId ?? null,
    status: existing?.status ?? "active",
    taxable: existing?.taxable ?? true,
    trackInventory: existing?.trackInventory ?? true,
    publishedOnline: existing?.publishedOnline ?? true,
    tags: [...(existing?.tags ?? [])],
    options,
    imageMediaIds: values.images.map((image) => image.mediaId),
    variants,
  };
}
