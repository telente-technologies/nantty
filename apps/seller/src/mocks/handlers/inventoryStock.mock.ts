import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { runOnceForIdempotencyKey } from "@/mocks/mockIdempotency.mock";
import { MockHttpError, createMockIdentifier, matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockPrincipal, type MockRequest } from "@/mocks/mockRouter.mock";
import { applyStockDeltaToMockVariant, findMockVariantWithProduct, readOnHandAtLocation, recordCatalogAuditEntry } from "@/mocks/handlers/productCatalogStore.mock";
import type { StockAdjustment, StockAdjustmentReason, StockTransfer } from "@/types/catalog.type";
import type { InventoryLevelRow } from "@/types/productRequests.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

const adjustmentReasons: readonly StockAdjustmentReason[] = ["received", "count", "damaged", "theft", "returned", "expired", "other"];
const maximumLinesPerStockChange = 200;

function isKnownLocation(locationId: unknown): locationId is string {
  return typeof locationId === "string" && readMockDatabase().locations.some((location) => location.id === locationId);
}

function readDefaultLocationId(request: MockRequest): string {
  const requested = request.query.get("locationId") ?? request.locationId;
  if (isKnownLocation(requested)) return requested;
  const database = readMockDatabase();
  return database.locations.find((location) => location.isDefault)?.id ?? database.locations[0]?.id ?? "";
}

function readQuantityLines(value: unknown, quantityKey: "quantityDelta" | "quantity", issues: ValidationIssue[]): { variantId: string; quantity: number }[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximumLinesPerStockChange) {
    issues.push({ path: "lines", message: `Add between 1 and ${maximumLinesPerStockChange} items.` });
    return [];
  }
  const seenVariantIds = new Set<string>();
  return value.map((rawLine, index) => {
    const line = (typeof rawLine === "object" && rawLine !== null ? rawLine : {}) as Record<string, unknown>;
    const variantId = typeof line.variantId === "string" ? line.variantId : "";
    const quantity = line[quantityKey];
    if (!findMockVariantWithProduct(variantId)) issues.push({ path: `lines.${index}.variantId`, message: `Line ${index + 1}: pick an item.` });
    if (seenVariantIds.has(variantId)) issues.push({ path: `lines.${index}.variantId`, message: `Line ${index + 1}: this item is listed twice.` });
    seenVariantIds.add(variantId);
    const isValidQuantity = typeof quantity === "number" && Number.isSafeInteger(quantity) && Math.abs(quantity) <= 1_000_000 && (quantityKey === "quantity" ? quantity > 0 : quantity !== 0);
    if (!isValidQuantity) issues.push({ path: `lines.${index}.${quantityKey}`, message: `Line ${index + 1}: enter a whole number${quantityKey === "quantity" ? " above zero" : " other than zero"}.` });
    return { variantId, quantity: isValidQuantity ? (quantity as number) : 0 };
  });
}

function readOptionalNote(value: unknown, issues: ValidationIssue[]): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 500) issues.push({ path: "note", message: "Notes must be 500 characters or fewer." });
  return typeof value === "string" ? value.trim().slice(0, 500) : null;
}

function describeActor(principal: MockPrincipal) {
  return { id: principal.staffId ?? principal.userId, name: principal.actorName };
}

function buildInventoryLevelRows(locationId: string): InventoryLevelRow[] {
  return readMockDatabase().products.filter((product) => product.status !== "archived" && product.trackInventory).flatMap((product) => product.variants.map((variant) => {
    const level = variant.stock.find((candidate) => candidate.locationId === locationId) ?? { onHand: 0, reserved: 0 };
    const available = level.onHand - level.reserved;
    return {
      variantId: variant.id, productId: product.id, productName: product.name, variantTitle: variant.title, sku: variant.sku,
      imageUrl: product.images[0]?.url ?? null, locationId, onHand: level.onHand, reserved: level.reserved, available,
      lowStockThreshold: variant.lowStockThreshold, costPrice: variant.costPrice,
      stockValue: variant.costPrice ? { amountMinor: variant.costPrice.amountMinor * Math.max(level.onHand, 0), currency: variant.costPrice.currency } : null,
    };
  }));
}

function createStockAdjustment(request: MockRequest) {
  const principal = requireMockStorePrincipal(request);
  const body = readJsonObjectBody(request);
  const issues: ValidationIssue[] = [];
  if (!isKnownLocation(body.locationId)) issues.push({ path: "locationId", message: "Choose a location." });
  const reason = body.reason as StockAdjustmentReason;
  if (!adjustmentReasons.includes(reason)) issues.push({ path: "reason", message: "Choose a reason for the change." });
  const lines = readQuantityLines(body.lines, "quantityDelta", issues);
  const note = readOptionalNote(body.note, issues);
  if ((reason === "other" || reason === "theft") && !note) issues.push({ path: "note", message: "Add a note explaining this change." });
  if (issues.length > 0) return respondWithValidationFailure(issues);
  const locationId = body.locationId as string;
  for (const line of lines) {
    const match = findMockVariantWithProduct(line.variantId);
    if (match && reason !== "count" && readOnHandAtLocation(match.variant, locationId) + line.quantity < 0) {
      throw new MockHttpError(409, "INSUFFICIENT_STOCK", `${match.product.name} (${match.variant.title}) would go below zero. Use "Stock count" if the shelf count is lower.`);
    }
  }
  const createdAdjustments: StockAdjustment[] = lines.map((line) => {
    const { product, variant } = applyStockDeltaToMockVariant(line.variantId, locationId, line.quantity, reason === "count");
    return { id: createMockIdentifier("adj"), variantId: variant.id, productName: product.name, variantTitle: variant.title, locationId, quantityDelta: line.quantity, reason, note, createdBy: describeActor(principal), createdAt: new Date().toISOString() };
  });
  readMockDatabase().stockAdjustments.unshift(...createdAdjustments);
  const locationName = readMockDatabase().locations.find((location) => location.id === locationId)?.name ?? locationId;
  recordCatalogAuditEntry(principal, "inventory.adjusted", "location", locationId, `Adjusted ${createdAdjustments.length} item(s) at ${locationName} (${reason})`);
  return respondWithJson(201, { data: createdAdjustments, nextCursor: null });
}

function createStockTransfer(request: MockRequest) {
  const principal = requireMockStorePrincipal(request);
  const body = readJsonObjectBody(request);
  const issues: ValidationIssue[] = [];
  if (!isKnownLocation(body.fromLocationId)) issues.push({ path: "fromLocationId", message: "Choose where the stock leaves from." });
  if (!isKnownLocation(body.toLocationId)) issues.push({ path: "toLocationId", message: "Choose where the stock goes." });
  if (body.fromLocationId === body.toLocationId) issues.push({ path: "toLocationId", message: "Pick two different locations." });
  const lines = readQuantityLines(body.lines, "quantity", issues);
  const note = readOptionalNote(body.note, issues);
  if (issues.length > 0) return respondWithValidationFailure(issues);
  const fromLocationId = body.fromLocationId as string;
  for (const line of lines) {
    const match = findMockVariantWithProduct(line.variantId);
    if (match && readOnHandAtLocation(match.variant, fromLocationId) < line.quantity) throw new MockHttpError(409, "INSUFFICIENT_STOCK", `Only ${readOnHandAtLocation(match.variant, fromLocationId)} of ${match.product.name} (${match.variant.title}) at the source location.`);
  }
  const transferLines = lines.map((line) => {
    const { product, variant } = applyStockDeltaToMockVariant(line.variantId, fromLocationId, -line.quantity, false);
    return { variantId: variant.id, productName: product.name, variantTitle: variant.title, quantity: line.quantity };
  });
  const database = readMockDatabase();
  const transfer: StockTransfer = {
    id: createMockIdentifier("trf"), reference: `TRF-${String(1001 + database.stockTransfers.length)}`, fromLocationId, toLocationId: body.toLocationId as string,
    status: "in_transit", lines: transferLines, note, createdBy: describeActor(principal), createdAt: new Date().toISOString(), receivedAt: null,
  };
  database.stockTransfers.unshift(transfer);
  recordCatalogAuditEntry(principal, "inventory.transfer_created", "transfer", transfer.id, `Sent ${transfer.reference} with ${transferLines.length} item(s)`);
  return respondWithJson(201, transfer);
}

function finishStockTransfer(request: MockRequest, outcome: "received" | "cancelled") {
  const principal = requireMockStorePrincipal(request);
  const database = readMockDatabase();
  const transferIndex = database.stockTransfers.findIndex((candidate) => candidate.id === request.params.transferId);
  const transfer = database.stockTransfers[transferIndex];
  if (!transfer) throw new MockHttpError(404, "TRANSFER_NOT_FOUND", "That transfer does not exist.");
  if (transfer.status !== "in_transit") throw new MockHttpError(409, "TRANSFER_ALREADY_FINISHED", `This transfer is already ${transfer.status.replace("_", " ")}.`);
  const destinationLocationId = outcome === "received" ? transfer.toLocationId : transfer.fromLocationId;
  for (const line of transfer.lines) applyStockDeltaToMockVariant(line.variantId, destinationLocationId, line.quantity, false);
  const finishedTransfer: StockTransfer = { ...transfer, status: outcome, receivedAt: outcome === "received" ? new Date().toISOString() : null };
  database.stockTransfers[transferIndex] = finishedTransfer;
  recordCatalogAuditEntry(principal, `inventory.transfer_${outcome}`, "transfer", transfer.id, `${outcome === "received" ? "Received" : "Cancelled"} ${transfer.reference}`);
  return respondWithJson(200, finishedTransfer);
}

export function registerInventoryStockMockRoutes(): void {
  registerMockRoute("GET", "/seller/inventory/levels", (request) => {
    requireMockStorePrincipal(request);
    const lowStockOnly = request.query.get("lowStockOnly") === "true";
    const rows = buildInventoryLevelRows(readDefaultLocationId(request))
      .filter((row) => !lowStockOnly || row.onHand <= row.lowStockThreshold)
      .filter((row) => matchesSearchText(request.query.get("q"), row.productName, row.sku, row.variantTitle))
      .sort((first, second) => first.productName.localeCompare(second.productName) || first.variantTitle.localeCompare(second.variantTitle));
    return respondWithJson(200, paginateMockList(rows, request.query, 50));
  });

  registerMockRoute("GET", "/seller/inventory/adjustments", (request) => {
    requireMockStorePrincipal(request);
    const locationId = request.query.get("locationId");
    const reason = request.query.get("reason");
    const adjustments = readMockDatabase().stockAdjustments.filter((adjustment) => (!locationId || adjustment.locationId === locationId) && (!reason || adjustment.reason === reason) && matchesSearchText(request.query.get("q"), adjustment.productName, adjustment.note));
    return respondWithJson(200, paginateMockList(adjustments, request.query));
  });

  registerMockRoute("POST", "/seller/inventory/adjustments", (request) => runOnceForIdempotencyKey(request, () => createStockAdjustment(request)));

  registerMockRoute("GET", "/seller/inventory/transfers", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    return respondWithJson(200, paginateMockList(readMockDatabase().stockTransfers.filter((transfer) => !status || transfer.status === status), request.query));
  });

  registerMockRoute("POST", "/seller/inventory/transfers", (request) => runOnceForIdempotencyKey(request, () => createStockTransfer(request)));
  registerMockRoute("POST", "/seller/inventory/transfers/:transferId/receive", (request) => runOnceForIdempotencyKey(request, () => finishStockTransfer(request, "received")));
  registerMockRoute("POST", "/seller/inventory/transfers/:transferId/cancel", (request) => runOnceForIdempotencyKey(request, () => finishStockTransfer(request, "cancelled")));
}
