import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { runOnceForIdempotencyKey } from "@/mocks/mockIdempotency.mock";
import {
  MockHttpError,
  matchesSearchText,
  paginateMockList,
  readJsonObjectBody,
  requireMockStorePrincipal,
  respondWithJson,
  respondWithValidationFailure,
} from "@/mocks/mockResponses.mock";
import { buildMockAuditActor, buildTimelineEvent, findOrderIndexOrThrow, isOrderAwaitingShipment, saveOrderWithTimelineEvent } from "@/mocks/handlers/orderMockHelpers.mock";
import { registerOrderActionMockHandlers } from "@/mocks/handlers/orderActionHandlers.mock";

import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { OnlineOrder, OnlineOrderStatus } from "@/types/order.type";

export { buildMockAuditActor };

const orderStatuses: OnlineOrderStatus[] = ["new", "processing", "ready", "shipped", "delivered", "completed", "cancelled", "returned", "refunded", "disputed"];
const httpUrlPattern = /^https:\/\/[^\s]{3,300}$/;

function filterOrdersForQuery(request: MockRequest): OnlineOrder[] {
  const status = request.query.get("status");
  const searchText = request.query.get("q");
  const from = request.query.get("from");
  const to = request.query.get("to");
  const fromTime = from ? new Date(`${from}T00:00:00.000Z`).getTime() : Number.NEGATIVE_INFINITY;
  const toTime = to ? new Date(`${to}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY;
  const filtered = readMockDatabase().onlineOrders.filter((order) => {
    if (status && status !== "all" && order.status !== status) return false;
    const createdTime = new Date(order.createdAt).getTime();
    if (createdTime < fromTime || createdTime > toTime) return false;
    return matchesSearchText(searchText, order.orderNumber, order.buyer.name, order.buyer.username, order.shippingAddress.city, order.paymentReference);
  });
  return sortOrdersForQuery(filtered, request.query.get("sort"), request.query.get("direction"));
}

function sortOrdersForQuery(orders: OnlineOrder[], sortKey: string | null, direction: string | null): OnlineOrder[] {
  const directionMultiplier = direction === "ascending" ? 1 : -1;
  const readSortValue = (order: OnlineOrder): number | string => {
    if (sortKey === "total") return order.total.amountMinor;
    if (sortKey === "items") return order.lines.reduce((sum, line) => sum + line.quantity, 0);
    if (sortKey === "buyer") return order.buyer.name.toLowerCase();
    if (sortKey === "status") return orderStatuses.indexOf(order.status);
    return order.createdAt;
  };
  return [...orders].sort((left, right) => {
    const leftValue = readSortValue(left);
    const rightValue = readSortValue(right);
    return (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0) * directionMultiplier;
  });
}

function removeShippedQuantitiesFromStock(order: OnlineOrder, locationId: string): void {
  const database = readMockDatabase();
  for (const line of order.lines) {
    const productIndex = database.products.findIndex((product) => product.id === line.productId);
    const product = database.products[productIndex];
    if (!product) continue;
    database.products[productIndex] = {
      ...product,
      variants: product.variants.map((variant) =>
        variant.id !== line.variantId
          ? variant
          : {
              ...variant,
              stock: variant.stock.map((level) =>
                level.locationId !== locationId
                  ? level
                  : { ...level, onHand: Math.max(0, level.onHand - line.quantity), reserved: Math.max(0, level.reserved - line.quantity) },
              ),
            },
      ),
    };
  }
}

function registerOrderFulfilmentHandlers(): void {
  registerMockRoute("POST", "/seller/orders/:orderId/fulfilment", (request) =>
    runOnceForIdempotencyKey(request, () => {
      const principal = requireMockStorePrincipal(request);
      const database = readMockDatabase();
      const orderIndex = findOrderIndexOrThrow(request.params.orderId ?? "");
      const order = database.onlineOrders[orderIndex] as OnlineOrder;
      const body = readJsonObjectBody(request);
      const courier = typeof body.courier === "string" ? body.courier.trim() : "";
      const trackingNumber = typeof body.trackingNumber === "string" ? body.trackingNumber.trim() : "";
      const trackingUrl = typeof body.trackingUrl === "string" && body.trackingUrl.trim() !== "" ? body.trackingUrl.trim() : null;
      const fromLocationId = typeof body.fromLocationId === "string" ? body.fromLocationId : "";
      const issues: { path: string; message: string }[] = [];
      if (courier.length < 2 || courier.length > 60) issues.push({ path: "courier", message: "Choose or type the courier." });
      if (!/^[A-Za-z0-9-]{4,40}$/.test(trackingNumber)) issues.push({ path: "trackingNumber", message: "Enter the tracking number (4–40 letters, digits or dashes)." });
      if (trackingUrl && !httpUrlPattern.test(trackingUrl)) issues.push({ path: "trackingUrl", message: "Tracking link must start with https://." });
      if (!database.locations.some((location) => location.id === fromLocationId && location.active)) issues.push({ path: "fromLocationId", message: "Choose the location you are shipping from." });
      if (issues.length > 0) return respondWithValidationFailure(issues);
      if (!isOrderAwaitingShipment(order)) throw new MockHttpError(409, "ORDER_NOT_SHIPPABLE", "Only new, processing or ready orders can be marked as shipped.");
      removeShippedQuantitiesFromStock(order, fromLocationId);
      const updatedOrder = saveOrderWithTimelineEvent(
        orderIndex,
        { status: "shipped", fulfilment: { courier, trackingNumber, trackingUrl, shippedAt: new Date().toISOString(), fromLocationId }, delivery: { ...order.delivery, status: "in_transit", estimatedDeliveryAt: new Date(Date.now() + 2 * 86_400_000).toISOString() } },
        buildTimelineEvent("shipped", `Handed to ${courier} · tracking ${trackingNumber}`, principal.actorName),
      );
      appendMockAuditLogEntry({ actor: buildMockAuditActor(principal), action: "order.shipped", targetType: "order", targetId: order.id, summary: `Marked ${order.orderNumber} as shipped with ${courier}` });
      return respondWithJson(200, updatedOrder);
    }),
  );

  registerMockRoute("POST", "/seller/orders/:orderId/cancel", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const orderIndex = findOrderIndexOrThrow(request.params.orderId ?? "");
    const order = database.onlineOrders[orderIndex] as OnlineOrder;
    const reason = String(readJsonObjectBody(request).reason ?? "").trim();
    if (reason.length < 5 || reason.length > 500) return respondWithValidationFailure([{ path: "reason", message: "Tell the buyer why (5–500 characters)." }]);
    if (!isOrderAwaitingShipment(order)) throw new MockHttpError(409, "ORDER_NOT_CANCELLABLE", "Only orders that have not shipped can be cancelled.");
    const refund = { id: `rf_${crypto.randomUUID().slice(0, 10)}`, amount: { amountMinor: order.total.amountMinor - order.refundedAmount.amountMinor, currency: order.total.currency }, reason, createdAt: new Date().toISOString() };
    const updatedOrder = saveOrderWithTimelineEvent(
      orderIndex,
      { status: "cancelled", escrowStatus: "refunded", paymentStatus: "refunded", refundedAmount: order.total, refunds: [...order.refunds, refund], delivery: { ...order.delivery, status: "cancelled" } },
      buildTimelineEvent("cancelled", `Cancelled: ${reason}`, principal.actorName),
    );
    appendMockAuditLogEntry({ actor: buildMockAuditActor(principal), action: "order.cancelled", targetType: "order", targetId: order.id, summary: `Cancelled ${order.orderNumber}: ${reason}` });
    return respondWithJson(200, updatedOrder);
  });
}

export function registerOrderMockHandlers(): void {
  registerMockRoute("GET", "/seller/orders", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    if (status && status !== "all" && !orderStatuses.includes(status as OnlineOrderStatus)) return respondWithValidationFailure([{ path: "status", message: "Unknown order status." }]);
    const orders = filterOrdersForQuery(request);
    const countsByStatus = Object.fromEntries(orderStatuses.map((orderStatus) => [orderStatus, readMockDatabase().onlineOrders.filter((order) => order.status === orderStatus).length]));
    return respondWithJson(200, { ...paginateMockList(orders, request.query), countsByStatus });
  });

  registerMockRoute("GET", "/seller/orders/:orderId", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readMockDatabase().onlineOrders[findOrderIndexOrThrow(request.params.orderId ?? "")]);
  });

  registerOrderFulfilmentHandlers();
  registerOrderActionMockHandlers();
}
