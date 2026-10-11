import { ApiError } from "@/errors/api.error";
import type { CatalogProduct, CatalogProductUpsertRequest, CatalogProductVariant } from "@/types/sellerCatalog.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { currentMediaAsset } from "./media.mock";
import { productImageUrlsForProduct } from "./mockImages.mock";
import { catalogProductSeeds, productIdForKey } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const productsById = new Map<string, CatalogProduct>();
const seededStoreIds = new Set<string>();
const productStoreIds = new Map<string, string>();

const signedInStoreIdOrThrow = () => {
  const storeId = getSignedInMockUser().storeId;
  if (!storeId) throw new ApiError(403, "Open a store to manage products", "STORE_NOT_APPROVED");
  return storeId;
};

export const MOCK_DEFAULT_LOCATION_ID = "0190f3a2-7b1c-7cde-9f00-0000000000a1";

function seedStoreProducts(storeId: string) {
  if (seededStoreIds.has(storeId)) return;
  seededStoreIds.add(storeId);
  for (const seed of catalogProductSeeds.filter((candidate) => candidate.storeId === storeId)) {
    const id = productIdForKey(seed.key);
    const price = convertUsdCentsToViewerCurrency(seed.usdCents);
    const options = [{ name: "Size", values: seed.sizes }, { name: "Color", values: seed.colors }, ...(seed.variants ?? []).map((group) => ({ name: group.name, values: group.options }))].filter((option) => option.values.length > 0).slice(0, 3);
    const rows = options.reduce<Record<string, string>[]>((all, option) => all.flatMap((row) => option.values.map((value) => ({ ...row, [option.name]: value }))), [{}]);
    const variants: CatalogProductVariant[] = rows.map((optionValues, index) => ({
      id: `${id}_v${index}`, title: Object.values(optionValues).join(" / ") || "Default", optionValues, sku: `SEED-${seed.key}-${index}`.toUpperCase(), barcode: null,
      price, compareAtPrice: null, costPrice: null, lowStockThreshold: 5, stock: [{ locationId: MOCK_DEFAULT_LOCATION_ID, onHand: index === 0 ? seed.stock : 0, reserved: 0 }],
    }));
    const images = productImageUrlsForProduct(seed.key).map((url, index) => ({ mediaId: `med_${seed.key}_${index}`, url }));
    productsById.set(id, { id, name: seed.name, description: seed.description, categoryId: null, status: "active", publishedOnline: true, images, options, variants, taxable: true, trackInventory: true, tags: [] });
    productStoreIds.set(id, storeId);
  }
}

const findOwnProductOrThrow = (productId: string) => {
  const storeId = signedInStoreIdOrThrow();
  seedStoreProducts(storeId);
  const product = productsById.get(productId);
  if (!product || productStoreIds.get(productId) !== storeId) throw new ApiError(404, "Product not found", "PRODUCT_NOT_FOUND");
  return product;
};

function validateUpsert(request: CatalogProductUpsertRequest, existing: CatalogProduct | null) {
  const name = request.name?.trim() ?? "";
  if (name.length < 2 || name.length > 120) throw new ApiError(400, "Name must be 2-120 characters", "VALIDATION_FAILED");
  if ((request.imageMediaIds ?? []).length > 10) throw new ApiError(400, "Must have at most 10 images", "VALIDATION_FAILED");
  if (!request.variants?.length) throw new ApiError(400, "Add at least one variant", "VALIDATION_FAILED");
  if ((request.options ?? []).length > 3) throw new ApiError(400, "Must have at most 3 options", "VALIDATION_FAILED");
  if ("price" in request || "imageUrls" in request || "stock" in request) throw new ApiError(400, "Unknown fields: use imageMediaIds and variants", "VALIDATION_FAILED");
  if (request.variants.some((variant) => !(variant.priceMinor >= 0) || !/^[A-Za-z0-9._-]{1,64}$/.test(variant.sku))) throw new ApiError(400, "Check the price and SKU", "VALIDATION_FAILED");
  for (const mediaId of request.imageMediaIds) {
    const alreadyOnProduct = existing?.images.some((image) => image.mediaId === mediaId) ?? false;
    if (!alreadyOnProduct && currentMediaAsset(mediaId)?.status !== "ready") throw new ApiError(422, "A photo is still processing. Try again in a moment.", "MEDIA_NOT_READY");
  }
}

function applyUpsert(id: string, request: CatalogProductUpsertRequest, existing: CatalogProduct | null): CatalogProduct {
  const currency = existing?.variants[0]?.price.currency ?? convertUsdCentsToViewerCurrency(100).currency;
  const images = request.imageMediaIds.map((mediaId) => existing?.images.find((image) => image.mediaId === mediaId) ?? { mediaId, url: currentMediaAsset(mediaId)?.variants[0]?.url ?? "" });
  const variants: CatalogProductVariant[] = request.variants.map((variant, index) => {
    const previous = existing?.variants.find((candidate) => candidate.id === variant.id);
    if (variant.id && !previous) throw new ApiError(404, "Variant not found", "VARIANT_NOT_FOUND");
    return {
      id: previous?.id ?? `${id}_v${Date.now().toString(36)}${index}`, title: Object.values(variant.optionValues).join(" / ") || "Default", optionValues: variant.optionValues, sku: variant.sku, barcode: variant.barcode,
      price: { amountMinor: variant.priceMinor, currency }, compareAtPrice: variant.compareAtPriceMinor === null ? null : { amountMinor: variant.compareAtPriceMinor, currency },
      costPrice: variant.costPriceMinor === null ? null : { amountMinor: variant.costPriceMinor, currency }, lowStockThreshold: variant.lowStockThreshold,
      stock: previous?.stock ?? (existing ? [] : variant.openingStock.map((level) => ({ locationId: level.locationId, onHand: level.quantity, reserved: 0 }))),
    };
  });
  const removedWithStock = existing?.variants.find((variant) => !variants.some((kept) => kept.id === variant.id) && variant.stock.some((level) => level.onHand > 0));
  if (removedWithStock) throw new ApiError(409, `${removedWithStock.title} still has stock. Adjust it to zero first.`, "VARIANT_HAS_STOCK");
  return {
    id, name: request.name.trim(), description: request.description.trim(), categoryId: request.categoryId, status: request.status, publishedOnline: request.status === "active" && request.publishedOnline,
    images, options: request.options, variants, taxable: request.taxable, trackInventory: request.trackInventory, tags: request.tags,
    brand: request.brand ? { brandId: request.brand.brandId, relationship: request.brand.relationship } : null,
  };
}

const createdByIdempotencyKey = new Map<string, string>();

export const sellerCatalogMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/seller/products", () => {
    const storeId = signedInStoreIdOrThrow();
    seedStoreProducts(storeId);
    return { data: [...productsById.values()].filter((product) => productStoreIds.get(product.id) === storeId && product.status !== "archived").reverse(), nextCursor: null };
  }),
  createMockRoute("GET", "/api/v1/seller/products/:productId", ({ params }) => findOwnProductOrThrow(params.productId!)),
  createMockRoute("POST", "/api/v1/seller/products", ({ body }) => {
    const storeId = signedInStoreIdOrThrow();
    seedStoreProducts(storeId);
    const request = body as CatalogProductUpsertRequest;
    const replayKey = `${storeId}:${request.name}:${request.variants?.[0]?.sku}`;
    const replayed = createdByIdempotencyKey.get(replayKey);
    if (replayed && productsById.has(replayed)) return productsById.get(replayed);
    validateUpsert(request, null);
    const id = `sp_new_${Date.now().toString(36)}`;
    productsById.set(id, applyUpsert(id, request, null));
    productStoreIds.set(id, storeId);
    createdByIdempotencyKey.set(replayKey, id);
    return productsById.get(id);
  }),
  createMockRoute("PATCH", "/api/v1/seller/products/:productId", ({ params, body }) => {
    const existing = findOwnProductOrThrow(params.productId!);
    const request = body as CatalogProductUpsertRequest;
    validateUpsert(request, existing);
    const updated = applyUpsert(existing.id, request, existing);
    productsById.set(existing.id, updated);
    return updated;
  }),
  createMockRoute("DELETE", "/api/v1/seller/products/:productId", ({ params }) => {
    const archived: CatalogProduct = { ...findOwnProductOrThrow(params.productId!), status: "archived", publishedOnline: false };
    productsById.set(archived.id, archived);
    return archived;
  }),
  createMockRoute("POST", "/api/v1/seller/products/:productId/publish", ({ params }) => {
    const published: CatalogProduct = { ...findOwnProductOrThrow(params.productId!), status: "active", publishedOnline: true };
    productsById.set(published.id, published);
    return published;
  }),
  createMockRoute("POST", "/api/v1/seller/products/:productId/unpublish", ({ params }) => {
    const hidden: CatalogProduct = { ...findOwnProductOrThrow(params.productId!), publishedOnline: false };
    productsById.set(hidden.id, hidden);
    return hidden;
  }),
];
