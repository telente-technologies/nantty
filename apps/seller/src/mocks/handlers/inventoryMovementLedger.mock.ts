import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { buildIsoDateDaysAgo, createSeededRandomNumberGenerator, pickRandomIntegerInclusive } from "@/mocks/seed/seededRandom.mock";
import { readMockSupplierSlice } from "@/mocks/handlers/supplierStore.mock";
import type { InventoryMovement, Product, ProductVariant } from "@/types/catalog.type";

interface SeededDeliverySlice {
  deliveries: InventoryMovement[];
}

function describeVariantForMovement(product: Product, variant: ProductVariant) {
  return { variantId: variant.id, productId: product.id, productName: product.name, variantTitle: variant.title, sku: variant.sku };
}

function readSeededSupplierDeliveries(): InventoryMovement[] {
  return readStoreScopedMockSlice<SeededDeliverySlice>("seededSupplierDeliveries", (storeId) => {
    const database = readMockDatabase();
    const random = createSeededRandomNumberGenerator(storeId.length * 7919);
    const suppliers = readMockSupplierSlice().suppliers;
    const defaultLocationId = database.locations.find((location) => location.isDefault)?.id ?? database.locations[0]?.id ?? "";
    const deliveries = database.products.slice(0, 18).flatMap((product, productIndex) => {
      const variant = product.variants[0];
      if (!variant) return [];
      const supplier = suppliers.find((candidate) => candidate.id === product.supplierId);
      return [0, 1].map((deliveryIndex): InventoryMovement => ({
        id: `mov_seed_${product.id}_${deliveryIndex}`,
        kind: "adjustment",
        ...describeVariantForMovement(product, variant),
        locationId: defaultLocationId,
        quantityDelta: pickRandomIntegerInclusive(6, 40, random),
        reference: `GRN-${String(2400 + productIndex * 2 + deliveryIndex)}`,
        note: supplier ? `Delivery from ${supplier.name}` : "Stock received",
        actorName: "Stockroom",
        createdAt: buildIsoDateDaysAgo(8 + productIndex * 2 + deliveryIndex * 21, 10),
      }));
    });
    return { deliveries };
  }).deliveries;
}

function collectAdjustmentAndTransferMovements(): InventoryMovement[] {
  const database = readMockDatabase();
  const skuByVariantId = new Map(database.products.flatMap((product) => product.variants.map((variant) => [variant.id, { sku: variant.sku, productId: product.id }] as const)));
  const adjustmentMovements = database.stockAdjustments.map((adjustment): InventoryMovement => ({
    id: `mov_${adjustment.id}`, kind: "adjustment", variantId: adjustment.variantId, productId: skuByVariantId.get(adjustment.variantId)?.productId ?? "", productName: adjustment.productName, variantTitle: adjustment.variantTitle,
    sku: skuByVariantId.get(adjustment.variantId)?.sku ?? "", locationId: adjustment.locationId, quantityDelta: adjustment.quantityDelta, reference: adjustment.reason.replace("_", " "), note: adjustment.note, actorName: adjustment.createdBy.name, createdAt: adjustment.createdAt,
  }));
  const transferMovements = database.stockTransfers.flatMap((transfer) => transfer.lines.flatMap((line, lineIndex): InventoryMovement[] => {
    const shared = { variantId: line.variantId, productId: skuByVariantId.get(line.variantId)?.productId ?? "", productName: line.productName, variantTitle: line.variantTitle, sku: skuByVariantId.get(line.variantId)?.sku ?? "", reference: transfer.reference, note: transfer.note, actorName: transfer.createdBy.name };
    const outgoing: InventoryMovement = { ...shared, id: `mov_${transfer.id}_${lineIndex}_out`, kind: "transfer_out", locationId: transfer.fromLocationId, quantityDelta: -line.quantity, createdAt: transfer.createdAt };
    if (transfer.status !== "received" || !transfer.receivedAt) return [outgoing];
    return [outgoing, { ...shared, id: `mov_${transfer.id}_${lineIndex}_in`, kind: "transfer_in", locationId: transfer.toLocationId, quantityDelta: line.quantity, createdAt: transfer.receivedAt }];
  }));
  return [...adjustmentMovements, ...transferMovements];
}

function collectOrderMovements(): InventoryMovement[] {
  const database = readMockDatabase();
  const defaultLocationId = database.locations.find((location) => location.isDefault)?.id ?? database.locations[0]?.id ?? "";
  return database.onlineOrders.flatMap((order) => {
    const isOpen = order.status === "new" || order.status === "processing" || order.status === "ready";
    const hasShipped = order.fulfilment !== null || ["shipped", "delivered", "completed", "returned"].includes(order.status);
    if (!isOpen && !hasShipped) return [];
    return order.lines.flatMap((line, lineIndex): InventoryMovement[] => {
      const shared = { variantId: line.variantId, productId: line.productId, productName: line.name, variantTitle: line.variantTitle, sku: line.sku, locationId: order.fulfilment?.fromLocationId ?? defaultLocationId, reference: order.orderNumber, actorName: `@${order.buyer.username}` };
      if (isOpen) return [{ ...shared, id: `mov_${order.id}_${lineIndex}_res`, kind: "order_reserved", quantityDelta: -line.quantity, note: "Held for an app order", createdAt: order.createdAt }];
      const shipped: InventoryMovement = { ...shared, id: `mov_${order.id}_${lineIndex}_ship`, kind: "order_shipped", quantityDelta: -line.quantity, note: order.fulfilment ? `Shipped with ${order.fulfilment.courier}` : "Shipped", createdAt: order.fulfilment?.shippedAt ?? order.createdAt };
      if (order.status !== "returned") return [shipped];
      return [shipped, { ...shared, id: `mov_${order.id}_${lineIndex}_ret`, kind: "order_returned", quantityDelta: line.quantity, note: "Returned by the buyer", createdAt: order.deliveredAt ?? order.createdAt }];
    });
  });
}

export function listInventoryMovementsNewestFirst(): InventoryMovement[] {
  return [...readSeededSupplierDeliveries(), ...collectAdjustmentAndTransferMovements(), ...collectOrderMovements()].sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}
