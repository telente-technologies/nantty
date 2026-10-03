import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { assertMockStorePlanIncludesFeature } from "@/mocks/handlers/catalogPlanRules.mock";
import { buildInventoryLevelRows, readDefaultLocationId } from "@/mocks/handlers/inventoryStock.mock";
import { listInventoryMovementsNewestFirst } from "@/mocks/handlers/inventoryMovementLedger.mock";
import { findMockVariantWithProduct, recordCatalogAuditEntry, replaceMockProduct } from "@/mocks/handlers/productCatalogStore.mock";
import { readMockSupplierSlice } from "@/mocks/handlers/supplierStore.mock";
import type { InventoryLocationSummary, InventorySummary, ReorderSuggestionRow } from "@/types/productRequests.type";

function buildStoreMoney(amountMinor: number) {
  return { amountMinor, currency: readMockDatabase().settings.currency };
}

function buildInventorySummaryForLocations(locationIds: readonly string[], summaryLocationId: string | null): InventorySummary {
  const database = readMockDatabase();
  const retailByVariantId = new Map(database.products.flatMap((product) => product.variants.map((variant) => [variant.id, variant.price.amountMinor] as const)));
  const rows = locationIds.flatMap((locationId) => buildInventoryLevelRows(locationId));
  return {
    locationId: summaryLocationId,
    skuCount: new Set(rows.map((row) => row.variantId)).size,
    onHand: rows.reduce((sum, row) => sum + row.onHand, 0),
    reserved: rows.reduce((sum, row) => sum + row.reserved, 0),
    available: rows.reduce((sum, row) => sum + Math.max(0, row.available), 0),
    lowStockCount: rows.filter((row) => row.available > 0 && row.available <= row.lowStockThreshold).length,
    outOfStockCount: rows.filter((row) => row.available <= 0).length,
    needsReorderCount: rows.filter((row) => row.available <= row.reorderPoint).length,
    stockValue: buildStoreMoney(rows.reduce((sum, row) => sum + (row.stockValue?.amountMinor ?? 0), 0)),
    retailValue: buildStoreMoney(rows.reduce((sum, row) => sum + (retailByVariantId.get(row.variantId) ?? 0) * Math.max(0, row.onHand), 0)),
  };
}

function buildReorderSuggestions(locationId: string): ReorderSuggestionRow[] {
  const database = readMockDatabase();
  const suppliers = readMockSupplierSlice().suppliers;
  const productById = new Map(database.products.map((product) => [product.id, product]));
  return buildInventoryLevelRows(locationId)
    .filter((row) => row.available <= row.reorderPoint)
    .map((row) => {
      const supplier = suppliers.find((candidate) => candidate.id === productById.get(row.productId)?.supplierId) ?? null;
      const suggestedQuantity = Math.max(row.reorderQuantity, row.reorderPoint - row.available + row.reorderQuantity - row.reorderPoint);
      return {
        variantId: row.variantId, productId: row.productId, productName: row.productName, variantTitle: row.variantTitle, sku: row.sku, locationId,
        available: row.available, reorderPoint: row.reorderPoint, reorderQuantity: row.reorderQuantity, suggestedQuantity,
        supplier: supplier ? { id: supplier.id, name: supplier.name, leadTimeDays: supplier.leadTimeDays } : null,
        estimatedCost: row.costPrice ? buildStoreMoney(row.costPrice.amountMinor * suggestedQuantity) : null,
      };
    })
    .sort((first, second) => first.available - first.reorderPoint - (second.available - second.reorderPoint));
}

export function registerInventoryInsightMockRoutes(): void {
  registerMockRoute("GET", "/seller/inventory/summary", (request) => {
    requireMockStorePrincipal(request);
    const requested = request.query.get("locationId");
    if (!requested || requested === "all") return respondWithJson(200, buildInventorySummaryForLocations(readMockDatabase().locations.filter((location) => location.active).map((location) => location.id), null));
    const locationId = readDefaultLocationId(request);
    return respondWithJson(200, buildInventorySummaryForLocations([locationId], locationId));
  });

  registerMockRoute("GET", "/seller/inventory/locations", (request) => {
    requireMockStorePrincipal(request);
    const summaries: InventoryLocationSummary[] = readMockDatabase().locations.map((location) => {
      const summary = buildInventorySummaryForLocations([location.id], location.id);
      return { locationId: location.id, name: location.name, kind: location.kind, city: location.city, isDefault: location.isDefault, active: location.active, skuCount: summary.skuCount, onHand: summary.onHand, reserved: summary.reserved, lowStockCount: summary.lowStockCount + summary.outOfStockCount, stockValue: summary.stockValue };
    });
    return respondWithJson(200, { data: summaries, nextCursor: null });
  });

  registerMockRoute("GET", "/seller/inventory/movements", (request) => {
    const principal = requireMockStorePrincipal(request);
    assertMockStorePlanIncludesFeature(principal.storeId, "advanced_inventory", "Stock movement history");
    const { query } = request;
    const fromTime = query.get("from") ? new Date(`${query.get("from")}T00:00:00.000Z`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = query.get("to") ? new Date(`${query.get("to")}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY;
    const movements = listInventoryMovementsNewestFirst().filter((movement) => {
      const createdTime = new Date(movement.createdAt).getTime();
      return (!query.get("locationId") || movement.locationId === query.get("locationId")) && (!query.get("kind") || movement.kind === query.get("kind")) && (!query.get("variantId") || movement.variantId === query.get("variantId"))
        && createdTime >= fromTime && createdTime <= toTime && matchesSearchText(query.get("q"), movement.productName, movement.sku, movement.reference);
    });
    return respondWithJson(200, paginateMockList(movements, query, 25));
  });

  registerMockRoute("GET", "/seller/inventory/reorder", (request) => {
    const principal = requireMockStorePrincipal(request);
    assertMockStorePlanIncludesFeature(principal.storeId, "advanced_inventory", "Reorder planning");
    return respondWithJson(200, paginateMockList(buildReorderSuggestions(readDefaultLocationId(request)), request.query, 50));
  });

  registerMockRoute("PATCH", "/seller/inventory/reorder-levels", (request) => {
    const principal = requireMockStorePrincipal(request);
    assertMockStorePlanIncludesFeature(principal.storeId, "advanced_inventory", "Reorder levels");
    const body = readJsonObjectBody(request);
    const match = findMockVariantWithProduct(typeof body.variantId === "string" ? body.variantId : "");
    if (!match) throw new MockHttpError(404, "VARIANT_NOT_FOUND", "That item no longer exists.");
    const isWhole = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
    const issues = [
      ...(isWhole(body.reorderPoint) ? [] : [{ path: "reorderPoint", message: "Reorder point must be a whole number from 0 to 1,000,000." }]),
      ...(isWhole(body.reorderQuantity) && (body.reorderQuantity as number) > 0 ? [] : [{ path: "reorderQuantity", message: "Reorder quantity must be at least 1." }]),
    ];
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const updatedVariant = { ...match.variant, reorderPoint: body.reorderPoint as number, reorderQuantity: body.reorderQuantity as number };
    replaceMockProduct({ ...match.product, variants: match.product.variants.map((variant) => (variant.id === updatedVariant.id ? updatedVariant : variant)), updatedAt: new Date().toISOString() });
    recordCatalogAuditEntry(principal, "inventory.reorder_level_set", "variant", updatedVariant.id, `Set reorder at ${updatedVariant.reorderPoint} (order ${updatedVariant.reorderQuantity}) for ${match.product.name}`);
    return respondWithJson(200, updatedVariant);
  });
}
