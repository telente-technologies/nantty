import { randomInt } from "node:crypto";

import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { buildMockProductFromRequest, collectSkusAndBarcodesOutsideProduct, findMockProductOrThrow, recordCatalogAuditEntry, replaceMockProduct, validateProductRequestAgainstStore } from "@/mocks/handlers/productCatalogStore.mock";
import type { Product, ProductStatus } from "@/types/catalog.type";
import type { ProductBulkAction, ProductUpsertRequest } from "@/types/productRequests.type";
import { buildEan13FromTwelveDigits } from "@/utils/ean13.util";
import { resolveProductBrandTagForStore } from "@/mocks/brandsMockStore.mock";

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readNullableInteger(value: unknown): number | null {
  return value === null || value === undefined || value === "" ? null : (value as number);
}

export function coerceProductUpsertRequest(body: Record<string, unknown>): ProductUpsertRequest {
  const options = Array.isArray(body.options) ? body.options : [];
  const variants = Array.isArray(body.variants) ? body.variants : [];
  return {
    name: typeof body.name === "string" ? body.name : "",
    description: typeof body.description === "string" ? body.description : "",
    categoryId: typeof body.categoryId === "string" ? body.categoryId : null,
    status: body.status as ProductStatus,
    taxable: body.taxable as boolean,
    trackInventory: body.trackInventory as boolean,
    publishedOnline: body.publishedOnline as boolean,
    tags: readStringArray(body.tags),
    imageMediaIds: readStringArray(body.imageMediaIds),
    options: options.map((option) => {
      const record = (typeof option === "object" && option !== null ? option : {}) as Record<string, unknown>;
      return { name: typeof record.name === "string" ? record.name : "", values: readStringArray(record.values) };
    }),
    variants: variants.map((variant) => {
      const record = (typeof variant === "object" && variant !== null ? variant : {}) as Record<string, unknown>;
      const optionValues = typeof record.optionValues === "object" && record.optionValues !== null ? (record.optionValues as Record<string, unknown>) : {};
      return {
        id: typeof record.id === "string" ? record.id : null,
        optionValues: Object.fromEntries(Object.entries(optionValues).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
        sku: typeof record.sku === "string" ? record.sku : "",
        barcode: typeof record.barcode === "string" && record.barcode !== "" ? record.barcode : null,
        priceMinor: record.priceMinor as number,
        compareAtPriceMinor: readNullableInteger(record.compareAtPriceMinor),
        costPriceMinor: readNullableInteger(record.costPriceMinor),
        lowStockThreshold: record.lowStockThreshold as number,
        openingStock: (Array.isArray(record.openingStock) ? record.openingStock : []).map((entry) => {
          const stockRecord = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
          return { locationId: String(stockRecord.locationId ?? ""), quantity: stockRecord.quantity as number };
        }),
      };
    }),
  };
}

function sumOnHand(product: Product, locationId: string | null): number {
  return product.variants.reduce((sum, variant) => sum + variant.stock.filter((level) => !locationId || level.locationId === locationId).reduce((levelSum, level) => levelSum + level.onHand, 0), 0);
}

function isProductLowOrOutOfStock(product: Product, locationId: string | null, wanted: "low" | "out"): boolean {
  return product.variants.some((variant) => {
    const onHand = variant.stock.filter((level) => !locationId || level.locationId === locationId).reduce((sum, level) => sum + level.onHand, 0);
    return wanted === "out" ? onHand <= 0 : onHand > 0 && onHand <= variant.lowStockThreshold;
  });
}

function listProductsMatchingQuery(request: MockRequest): Product[] {
  const { query } = request;
  const status = query.get("status");
  const online = query.get("online");
  const stockFilter = query.get("stock");
  const locationId = query.get("locationId") || null;
  const filtered = readMockDatabase().products.filter((product) => {
    if (status && status !== "all" ? product.status !== status : !status && product.status === "archived") return false;
    if (query.get("categoryId") && product.categoryId !== query.get("categoryId")) return false;
    if (query.get("variantId") && !product.variants.some((variant) => variant.id === query.get("variantId"))) return false;
    if (online === "true" && !product.publishedOnline) return false;
    if (online === "false" && product.publishedOnline) return false;
    if ((stockFilter === "low" || stockFilter === "out") && !isProductLowOrOutOfStock(product, locationId, stockFilter)) return false;
    return matchesSearchText(query.get("q"), product.name, ...product.variants.flatMap((variant) => [variant.sku, variant.barcode]));
  });
  const sort = query.get("sort") ?? "updated";
  const lowestPrice = (product: Product) => Math.min(...product.variants.map((variant) => variant.price.amountMinor));
  return [...filtered].sort((first, second) => {
    if (sort === "name") return first.name.localeCompare(second.name);
    if (sort === "price_asc") return lowestPrice(first) - lowestPrice(second);
    if (sort === "price_desc") return lowestPrice(second) - lowestPrice(first);
    if (sort === "stock") return sumOnHand(first, locationId) - sumOnHand(second, locationId);
    return second.updatedAt.localeCompare(first.updatedAt);
  });
}

function setProductOnlinePublication(request: MockRequest, shouldPublish: boolean) {
  const principal = requireMockStorePrincipal(request);
  const product = findMockProductOrThrow(request.params.productId ?? "");
  if (shouldPublish && product.status !== "active") throw new MockHttpError(409, "PRODUCT_NOT_ACTIVE", "Only active products can be published to the marketplace.");
  if (shouldPublish && product.images.length === 0) throw new MockHttpError(409, "PRODUCT_NEEDS_IMAGE", "Add at least one photo before publishing to the marketplace.");
  const updatedProduct: Product = { ...product, publishedOnline: shouldPublish, updatedAt: new Date().toISOString() };
  replaceMockProduct(updatedProduct);
  recordCatalogAuditEntry(principal, shouldPublish ? "product.published" : "product.unpublished", "product", product.id, `${shouldPublish ? "Published" : "Unpublished"} ${product.name} ${shouldPublish ? "to" : "from"} the marketplace`);
  return respondWithJson(200, updatedProduct);
}

export function registerProductCatalogMockRoutes(): void {
  registerMockRoute("GET", "/seller/categories", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: readMockDatabase().categories, nextCursor: null });
  });

  registerMockRoute("GET", "/seller/products", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, paginateMockList(listProductsMatchingQuery(request), request.query, 25));
  });

  registerMockRoute("POST", "/seller/products", (request) => {
    const principal = requireMockStorePrincipal(request);
    const productRequest = coerceProductUpsertRequest(readJsonObjectBody(request));
    const brandResolution = resolveProductBrandTagForStore(principal.storeId, readJsonObjectBody(request).brand);
    const issues = [...validateProductRequestAgainstStore(productRequest, null), ...brandResolution.issues];
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const product = { ...buildMockProductFromRequest(productRequest, null), brand: brandResolution.tag ?? null };
    replaceMockProduct(product);
    recordCatalogAuditEntry(principal, "product.created", "product", product.id, `Created ${product.name} with ${product.variants.length} variant(s)`);
    return respondWithJson(201, product);
  });

  registerMockRoute("POST", "/seller/products/barcodes", (request) => {
    requireMockStorePrincipal(request);
    const count = readJsonObjectBody(request).count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 100) throw new MockHttpError(400, "INVALID_COUNT", "Ask for between 1 and 100 barcodes.");
    const used = collectSkusAndBarcodesOutsideProduct(null).barcodes;
    const barcodes: string[] = [];
    while (barcodes.length < count) {
      const candidate = buildEan13FromTwelveDigits(`2${String(randomInt(0, 100_000_000_000)).padStart(11, "0")}`);
      if (!used.has(candidate) && !barcodes.includes(candidate)) barcodes.push(candidate);
    }
    return respondWithJson(200, { barcodes });
  });

  registerMockRoute("POST", "/seller/products/bulk", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const action = body.action as ProductBulkAction;
    const productIds = readStringArray(body.productIds);
    if (!["publish", "unpublish", "archive"].includes(action)) throw new MockHttpError(400, "INVALID_ACTION", "Choose publish, unpublish or archive.");
    if (productIds.length < 1 || productIds.length > 200) throw new MockHttpError(400, "INVALID_SELECTION", "Select between 1 and 200 products.");
    const updatedProductIds: string[] = [];
    for (const productId of productIds) {
      const product = findMockProductOrThrow(productId);
      if (action === "publish" && (product.status !== "active" || product.images.length === 0)) continue;
      replaceMockProduct({
        ...product,
        publishedOnline: action === "publish",
        status: action === "archive" ? "archived" : product.status,
        updatedAt: new Date().toISOString(),
      });
      updatedProductIds.push(productId);
    }
    recordCatalogAuditEntry(principal, `product.bulk_${action}`, "product", null, `Bulk ${action} on ${updatedProductIds.length} product(s)`);
    return respondWithJson(200, { updatedProductIds });
  });

  registerMockRoute("GET", "/seller/products/:productId", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, findMockProductOrThrow(request.params.productId ?? ""));
  });

  registerMockRoute("PATCH", "/seller/products/:productId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const existingProduct = findMockProductOrThrow(request.params.productId ?? "");
    const productRequest = coerceProductUpsertRequest(readJsonObjectBody(request));
    const brandResolution = resolveProductBrandTagForStore(principal.storeId, readJsonObjectBody(request).brand);
    const issues = [...validateProductRequestAgainstStore(productRequest, existingProduct.id), ...brandResolution.issues];
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const product = { ...buildMockProductFromRequest(productRequest, existingProduct), brand: brandResolution.tag === undefined ? existingProduct.brand ?? null : brandResolution.tag };
    replaceMockProduct(product);
    recordCatalogAuditEntry(principal, "product.updated", "product", product.id, `Updated ${product.name}`);
    return respondWithJson(200, product);
  });

  registerMockRoute("DELETE", "/seller/products/:productId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const product = findMockProductOrThrow(request.params.productId ?? "");
    const archivedProduct: Product = { ...product, status: "archived", publishedOnline: false, updatedAt: new Date().toISOString() };
    replaceMockProduct(archivedProduct);
    recordCatalogAuditEntry(principal, "product.archived", "product", product.id, `Archived ${product.name}`);
    return respondWithJson(200, archivedProduct);
  });

  registerMockRoute("POST", "/seller/products/:productId/publish", (request) => setProductOnlinePublication(request, true));
  registerMockRoute("POST", "/seller/products/:productId/unpublish", (request) => setProductOnlinePublication(request, false));
}
