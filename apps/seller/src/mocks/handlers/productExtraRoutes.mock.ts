import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier, readJsonObjectBody, requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { assertMockStorePlanIncludesFeature, readMaximumActiveProductsForStore } from "@/mocks/handlers/catalogPlanRules.mock";
import { collectSkusAndBarcodesOutsideProduct, findMockProductOrThrow, recordCatalogAuditEntry, replaceMockProduct } from "@/mocks/handlers/productCatalogStore.mock";
import { activateScheduledProductsWhosePublishTimeHasPassed } from "@/mocks/handlers/productCatalogRoutes.mock";
import { readStringArray } from "@/mocks/handlers/productRequestCoercion.mock";
import type { Product, ProductVisibility } from "@/types/catalog.type";
import type { ProductBulkAction, ProductUsageSummary } from "@/types/productRequests.type";
import { productVisibilities } from "@/utils/productValidation.util";

const productBulkActions: readonly ProductBulkAction[] = ["publish", "unpublish", "archive", "set_category", "set_visibility", "change_price_percent"];

function buildUniqueCopySku(originalSku: string, usedSkus: Set<string>): string {
  for (let copyNumber = 1; copyNumber < 100; copyNumber += 1) {
    const candidate = `${originalSku.slice(0, 56)}-COPY${copyNumber > 1 ? copyNumber : ""}`;
    if (!usedSkus.has(candidate.toLowerCase())) {
      usedSkus.add(candidate.toLowerCase());
      return candidate;
    }
  }
  return `${originalSku.slice(0, 40)}-${Date.now()}`;
}

function applyBulkActionToProduct(product: Product, action: ProductBulkAction, body: Record<string, unknown>): Product | null {
  const now = new Date().toISOString();
  if (action === "publish") return product.status === "active" && product.images.length > 0 ? { ...product, publishedOnline: true, updatedAt: now } : null;
  if (action === "unpublish") return { ...product, publishedOnline: false, updatedAt: now };
  if (action === "archive") return { ...product, status: "archived", publishedOnline: false, publishAt: null, updatedAt: now };
  if (action === "set_category") {
    const category = readMockDatabase().categories.find((candidate) => candidate.id === body.categoryId) ?? null;
    return { ...product, categoryId: category?.id ?? null, categoryName: category?.name ?? null, updatedAt: now };
  }
  if (action === "set_visibility") return { ...product, visibility: body.visibility as ProductVisibility, updatedAt: now };
  const basisPoints = body.pricePercentBasisPoints as number;
  return {
    ...product,
    updatedAt: now,
    variants: product.variants.map((variant) => {
      const newPriceMinor = Math.max(0, Math.round((variant.price.amountMinor * (10_000 + basisPoints)) / 10_000));
      const keepsCompareAt = variant.compareAtPrice !== null && variant.compareAtPrice.amountMinor > newPriceMinor;
      return { ...variant, price: { ...variant.price, amountMinor: newPriceMinor }, compareAtPrice: keepsCompareAt ? variant.compareAtPrice : null };
    }),
  };
}

function validateBulkActionBody(action: ProductBulkAction, body: Record<string, unknown>): void {
  if (action === "set_category" && body.categoryId !== null && !readMockDatabase().categories.some((category) => category.id === body.categoryId)) throw new MockHttpError(400, "INVALID_CATEGORY", "Choose one of your categories.");
  if (action === "set_visibility" && !productVisibilities.includes(body.visibility as ProductVisibility)) throw new MockHttpError(400, "INVALID_VISIBILITY", "Choose who can see the products.");
  if (action === "change_price_percent") {
    const basisPoints = body.pricePercentBasisPoints;
    if (typeof basisPoints !== "number" || !Number.isInteger(basisPoints) || basisPoints < -9_000 || basisPoints > 50_000 || basisPoints === 0) throw new MockHttpError(400, "INVALID_PERCENT", "Change prices by between −90% and +500%.");
  }
}

export function registerProductExtraMockRoutes(): void {
  registerMockRoute("GET", "/seller/products/usage", (request) => {
    const principal = requireMockStorePrincipal(request);
    activateScheduledProductsWhosePublishTimeHasPassed();
    const products = readMockDatabase().products;
    const summary: ProductUsageSummary = {
      activeProducts: products.filter((product) => product.status === "active").length,
      draftProducts: products.filter((product) => product.status === "draft" && !product.publishAt).length,
      scheduledProducts: products.filter((product) => product.status === "draft" && product.publishAt !== null).length,
      archivedProducts: products.filter((product) => product.status === "archived").length,
      maxActiveProducts: readMaximumActiveProductsForStore(principal.storeId),
    };
    return respondWithJson(200, summary);
  });

  registerMockRoute("POST", "/seller/products/bulk", (request) => {
    const principal = requireMockStorePrincipal(request);
    assertMockStorePlanIncludesFeature(principal.storeId, "bulk_tools", "Bulk editing");
    const body = readJsonObjectBody(request);
    const action = body.action as ProductBulkAction;
    const productIds = readStringArray(body.productIds);
    if (!productBulkActions.includes(action)) throw new MockHttpError(400, "INVALID_ACTION", "Choose a bulk action.");
    if (productIds.length < 1 || productIds.length > 200) throw new MockHttpError(400, "INVALID_SELECTION", "Select between 1 and 200 products.");
    validateBulkActionBody(action, body);
    const updatedProductIds: string[] = [];
    for (const productId of productIds) {
      const updatedProduct = applyBulkActionToProduct(findMockProductOrThrow(productId), action, body);
      if (!updatedProduct) continue;
      replaceMockProduct(updatedProduct);
      updatedProductIds.push(productId);
    }
    recordCatalogAuditEntry(principal, `product.bulk_${action}`, "product", null, `Bulk ${action.replace(/_/g, " ")} on ${updatedProductIds.length} product(s)`);
    return respondWithJson(200, { updatedProductIds });
  });

  registerMockRoute("POST", "/seller/products/:productId/duplicate", (request) => {
    const principal = requireMockStorePrincipal(request);
    const original = findMockProductOrThrow(request.params.productId ?? "");
    const usedSkus = collectSkusAndBarcodesOutsideProduct(null).skus;
    const copyId = createMockIdentifier("prod");
    const now = new Date().toISOString();
    const copy: Product = {
      ...original,
      id: copyId,
      name: `${original.name} (copy)`.slice(0, 120),
      status: "draft",
      publishedOnline: false,
      publishAt: null,
      variants: original.variants.map((variant) => ({ ...variant, id: createMockIdentifier("var"), productId: copyId, sku: buildUniqueCopySku(variant.sku, usedSkus), barcode: null, stock: variant.stock.map((level) => ({ ...level, onHand: 0, reserved: 0 })) })),
      createdAt: now,
      updatedAt: now,
    };
    replaceMockProduct(copy);
    recordCatalogAuditEntry(principal, "product.duplicated", "product", copy.id, `Duplicated ${original.name} as a draft`);
    return respondWithJson(201, copy);
  });
}
