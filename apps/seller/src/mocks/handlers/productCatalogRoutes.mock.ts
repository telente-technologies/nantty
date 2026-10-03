import { randomInt } from "node:crypto";

import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { buildMockProductFromRequest, collectSkusAndBarcodesOutsideProduct, findMockProductOrThrow, recordCatalogAuditEntry, replaceMockProduct, validateProductRequestAgainstStore } from "@/mocks/handlers/productCatalogStore.mock";
import type { Product } from "@/types/catalog.type";
import { buildEan13FromTwelveDigits } from "@/utils/ean13.util";
import { resolveProductBrandTagForStore } from "@/mocks/brandsMockStore.mock";
import { assertActiveProductSlotAvailable } from "@/mocks/handlers/catalogPlanRules.mock";
import { coerceProductUpsertRequest } from "@/mocks/handlers/productRequestCoercion.mock";

function sumOnHand(product: Product, locationId: string | null): number {
  return product.variants.reduce((sum, variant) => sum + variant.stock.filter((level) => !locationId || level.locationId === locationId).reduce((levelSum, level) => levelSum + level.onHand, 0), 0);
}

function isProductLowOrOutOfStock(product: Product, locationId: string | null, wanted: "low" | "out"): boolean {
  return product.variants.some((variant) => {
    const onHand = variant.stock.filter((level) => !locationId || level.locationId === locationId).reduce((sum, level) => sum + level.onHand, 0);
    return wanted === "out" ? onHand <= 0 : onHand > 0 && onHand <= variant.lowStockThreshold;
  });
}

export function activateScheduledProductsWhosePublishTimeHasPassed(): void {
  const now = Date.now();
  for (const product of readMockDatabase().products) {
    if (product.status !== "draft" || !product.publishAt || new Date(product.publishAt).getTime() > now) continue;
    replaceMockProduct({ ...product, status: "active", publishedOnline: product.images.length > 0, publishAt: null, updatedAt: new Date().toISOString() });
  }
}

function doesProductMatchStatusFilter(product: Product, status: string | null): boolean {
  if (!status) return product.status !== "archived";
  if (status === "all") return true;
  if (status === "scheduled") return product.status === "draft" && product.publishAt !== null;
  return product.status === status;
}

function listProductsMatchingQuery(request: MockRequest): Product[] {
  activateScheduledProductsWhosePublishTimeHasPassed();
  const { query } = request;
  const status = query.get("status");
  const online = query.get("online");
  const stockFilter = query.get("stock");
  const locationId = query.get("locationId") || null;
  const filtered = readMockDatabase().products.filter((product) => {
    if (!doesProductMatchStatusFilter(product, status)) return false;
    if (query.get("visibility") && product.visibility !== query.get("visibility")) return false;
    if (query.get("supplierId") && product.supplierId !== query.get("supplierId")) return false;
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
    if (sort === "name_desc") return second.name.localeCompare(first.name);
    if (sort === "stock_desc") return sumOnHand(second, locationId) - sumOnHand(first, locationId);
    if (sort === "updated_asc") return first.updatedAt.localeCompare(second.updatedAt);
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
    if (productRequest.status === "active") assertActiveProductSlotAvailable(principal.storeId, null);
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

  registerMockRoute("GET", "/seller/products/:productId", (request) => {
    requireMockStorePrincipal(request);
    activateScheduledProductsWhosePublishTimeHasPassed();
    return respondWithJson(200, findMockProductOrThrow(request.params.productId ?? ""));
  });

  registerMockRoute("PATCH", "/seller/products/:productId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const existingProduct = findMockProductOrThrow(request.params.productId ?? "");
    const productRequest = coerceProductUpsertRequest(readJsonObjectBody(request));
    const brandResolution = resolveProductBrandTagForStore(principal.storeId, readJsonObjectBody(request).brand);
    const issues = [...validateProductRequestAgainstStore(productRequest, existingProduct.id), ...brandResolution.issues];
    if (issues.length > 0) return respondWithValidationFailure(issues);
    if (productRequest.status === "active" && existingProduct.status !== "active") assertActiveProductSlotAvailable(principal.storeId, existingProduct.id);
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
