import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier } from "@/mocks/mockResponses.mock";
import type { MockPrincipal } from "@/mocks/mockRouter.mock";
import type { Product, ProductImage, ProductVariant, StockLevel } from "@/types/catalog.type";
import type { ProductUpsertRequest } from "@/types/productRequests.type";
import { readMockSupplierSlice } from "@/mocks/handlers/supplierStore.mock";
import { buildVariantTitleFromOptionValues, validateProductUpsertRequest } from "@/utils/productValidation.util";

export function findMockProductOrThrow(productId: string): Product {
  const product = readMockDatabase().products.find((candidate) => candidate.id === productId);
  if (!product) throw new MockHttpError(404, "PRODUCT_NOT_FOUND", "That product does not exist in your store.");
  return product;
}

export function findMockVariantWithProduct(variantId: string): { product: Product; variant: ProductVariant } | null {
  for (const product of readMockDatabase().products) {
    const variant = product.variants.find((candidate) => candidate.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

export function replaceMockProduct(updatedProduct: Product): void {
  const database = readMockDatabase();
  const productIndex = database.products.findIndex((candidate) => candidate.id === updatedProduct.id);
  if (productIndex === -1) database.products.unshift(updatedProduct);
  else database.products[productIndex] = updatedProduct;
}

export function readOnHandAtLocation(variant: ProductVariant, locationId: string): number {
  return variant.stock.find((level) => level.locationId === locationId)?.onHand ?? 0;
}

export function applyStockDeltaToMockVariant(variantId: string, locationId: string, quantityDelta: number, allowNegativeResult: boolean): { product: Product; variant: ProductVariant; onHandAfter: number } {
  const match = findMockVariantWithProduct(variantId);
  if (!match) throw new MockHttpError(404, "VARIANT_NOT_FOUND", "One of the items no longer exists.");
  const onHandBefore = readOnHandAtLocation(match.variant, locationId);
  const onHandAfter = onHandBefore + quantityDelta;
  if (onHandAfter < 0 && !allowNegativeResult) {
    throw new MockHttpError(409, "INSUFFICIENT_STOCK", `${match.product.name} (${match.variant.title}) has only ${onHandBefore} in stock at that location.`);
  }
  const hasLevel = match.variant.stock.some((level) => level.locationId === locationId);
  const updatedStock: StockLevel[] = hasLevel
    ? match.variant.stock.map((level) => (level.locationId === locationId ? { ...level, onHand: onHandAfter } : level))
    : [...match.variant.stock, { locationId, onHand: onHandAfter, reserved: 0 }];
  const updatedVariant: ProductVariant = { ...match.variant, stock: updatedStock };
  const updatedProduct: Product = { ...match.product, variants: match.product.variants.map((variant) => (variant.id === variantId ? updatedVariant : variant)), updatedAt: new Date().toISOString() };
  replaceMockProduct(updatedProduct);
  return { product: updatedProduct, variant: updatedVariant, onHandAfter };
}

export function collectSkusAndBarcodesOutsideProduct(excludedProductId: string | null): { skus: Set<string>; barcodes: Set<string> } {
  const skus = new Set<string>();
  const barcodes = new Set<string>();
  for (const product of readMockDatabase().products) {
    if (product.id === excludedProductId) continue;
    for (const variant of product.variants) {
      skus.add(variant.sku.toLowerCase());
      if (variant.barcode) barcodes.add(variant.barcode);
    }
  }
  return { skus, barcodes };
}

function resolveProductImages(imageMediaIds: readonly string[], existingImages: readonly ProductImage[]): ProductImage[] {
  const database = readMockDatabase();
  return imageMediaIds.map((mediaId) => {
    const existingImage = existingImages.find((image) => image.mediaId === mediaId);
    if (existingImage) return existingImage;
    const media = database.media.get(mediaId);
    if (!media || media.status !== "ready") throw new MockHttpError(422, "MEDIA_NOT_READY", "One of the images has not finished uploading.");
    return { mediaId, url: media.url };
  });
}

export function validateProductRequestAgainstStore(request: ProductUpsertRequest, excludedProductId: string | null) {
  const database = readMockDatabase();
  const used = collectSkusAndBarcodesOutsideProduct(excludedProductId);
  return validateProductUpsertRequest(request, {
    categoryIds: database.categories.map((category) => category.id),
    locationIds: database.locations.map((location) => location.id),
    skusUsedByOtherProducts: used.skus,
    barcodesUsedByOtherProducts: used.barcodes,
    supplierIds: readMockSupplierSlice().suppliers.map((supplier) => supplier.id),
  });
}

export function buildMockProductFromRequest(request: ProductUpsertRequest, existingProduct: Product | null): Product {
  const database = readMockDatabase();
  const currency = database.settings.currency;
  const productId = existingProduct?.id ?? createMockIdentifier("prod");
  const optionNames = request.options.map((option) => option.name.trim());
  const variants: ProductVariant[] = request.variants.map((variantRequest) => {
    const existingVariant = variantRequest.id ? existingProduct?.variants.find((variant) => variant.id === variantRequest.id) : undefined;
    if (variantRequest.id && !existingVariant) throw new MockHttpError(404, "VARIANT_NOT_FOUND", "A variant you edited no longer exists. Reload the product.");
    const stock: StockLevel[] = existingVariant?.stock ?? database.locations.map((location) => ({
      locationId: location.id,
      onHand: variantRequest.openingStock.find((entry) => entry.locationId === location.id)?.quantity ?? 0,
      reserved: 0,
    }));
    return {
      id: existingVariant?.id ?? createMockIdentifier("var"),
      productId,
      title: buildVariantTitleFromOptionValues(variantRequest.optionValues, optionNames),
      optionValues: variantRequest.optionValues,
      sku: variantRequest.sku.trim(),
      barcode: variantRequest.barcode,
      price: { amountMinor: variantRequest.priceMinor, currency },
      compareAtPrice: variantRequest.compareAtPriceMinor === null ? null : { amountMinor: variantRequest.compareAtPriceMinor, currency },
      costPrice: variantRequest.costPriceMinor === null ? null : { amountMinor: variantRequest.costPriceMinor, currency },
      regionalPrices: (variantRequest.regionalPrices ?? []).filter((price) => price.currency !== currency),
      lowStockThreshold: variantRequest.lowStockThreshold,
      reorderPoint: variantRequest.reorderPoint ?? existingVariant?.reorderPoint ?? variantRequest.lowStockThreshold,
      reorderQuantity: variantRequest.reorderQuantity ?? existingVariant?.reorderQuantity ?? Math.max(10, variantRequest.lowStockThreshold * 4),
      stock,
    };
  });
  if (existingProduct) {
    const removedVariantWithStock = existingProduct.variants.find((variant) => !variants.some((kept) => kept.id === variant.id) && variant.stock.some((level) => level.onHand !== 0));
    if (removedVariantWithStock) throw new MockHttpError(409, "VARIANT_HAS_STOCK", `${removedVariantWithStock.title} still has stock. Adjust it to zero before removing the variant.`);
  }
  const category = database.categories.find((candidate) => candidate.id === request.categoryId) ?? null;
  const now = new Date().toISOString();
  return {
    id: productId,
    name: request.name.trim(),
    description: request.description.trim(),
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    status: request.status,
    publishedOnline: request.status === "active" ? request.publishedOnline : false,
    images: resolveProductImages(request.imageMediaIds, existingProduct?.images ?? []),
    options: request.options.map((option) => ({ name: option.name.trim(), values: option.values.map((value) => value.trim()) })),
    variants,
    taxable: request.taxable,
    trackInventory: request.trackInventory,
    tags: [...new Set(request.tags.map((tag) => tag.trim().toLowerCase()))],
    brand: existingProduct?.brand ?? null,
    visibility: request.visibility ?? existingProduct?.visibility ?? "public",
    publishAt: request.status === "draft" ? request.publishAt ?? null : null,
    attributes: (request.attributes ?? existingProduct?.attributes ?? []).map((attribute) => ({ name: attribute.name.trim(), value: attribute.value.trim() })),
    videos: request.videos === undefined ? existingProduct?.videos ?? [] : request.videos.map((video, index) => ({ id: existingProduct?.videos.find((candidate) => candidate.url === video.url)?.id ?? createMockIdentifier(`vid${index}`), url: video.url, title: video.title.trim() })),
    supplierId: request.supplierId === undefined ? existingProduct?.supplierId ?? null : request.supplierId,
    createdAt: existingProduct?.createdAt ?? now,
    updatedAt: now,
  };
}

export function recordCatalogAuditEntry(principal: MockPrincipal, action: string, targetType: string, targetId: string | null, summary: string): void {
  appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "manager" }, action, targetType, targetId, summary });
}
