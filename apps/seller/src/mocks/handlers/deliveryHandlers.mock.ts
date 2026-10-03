import { buildTimelineEvent, findOrderIndexOrThrow, saveOrderWithTimelineEvent } from "@/mocks/handlers/orderMockHelpers.mock";
import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier, matchesSearchText, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { buildDemoDeliveryAreas } from "@/mocks/seed/demoDeliveryAreas.mock";
import type { DeliveryArea, DeliveryPipelineStatus, DeliveryShipment, DeliverySummary } from "@/types/delivery.type";
import type { OnlineOrder } from "@/types/order.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

const pipelineStatuses: DeliveryPipelineStatus[] = ["pending", "preparing", "ready_for_pickup", "in_transit", "delivered", "failed"];

function convertOrderToShipment(order: OnlineOrder): DeliveryShipment {
  const lastEvent = order.timeline[order.timeline.length - 1];
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    buyerName: order.buyer.name,
    buyerUsername: order.buyer.username,
    city: order.shippingAddress.city,
    state: order.shippingAddress.state,
    status: order.delivery.status,
    courier: order.fulfilment?.courier ?? null,
    trackingNumber: order.fulfilment?.trackingNumber ?? null,
    riderName: order.delivery.riderName,
    riderPhone: order.delivery.riderPhone,
    estimatedDeliveryAt: order.delivery.estimatedDeliveryAt,
    attempts: order.delivery.attempts,
    lastAttemptNote: order.delivery.lastAttemptNote,
    deliveryFee: order.shippingFee,
    itemsCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    orderedAt: order.createdAt,
    updatedAt: lastEvent?.createdAt ?? order.createdAt,
  };
}

function readDeliveryAreas(): DeliveryArea[] {
  return readStoreScopedMockSlice("deliveryAreas", () => {
    const database = readMockDatabase();
    const homeState = database.locations.find((location) => location.isDefault)?.state ?? "Lagos";
    return buildDemoDeliveryAreas(homeState, database.settings.currency);
  });
}

function buildDeliverySummary(): DeliverySummary {
  const orders = readMockDatabase().onlineOrders;
  const countsByStatus = Object.fromEntries(pipelineStatuses.map((status) => [status, orders.filter((order) => order.delivery.status === status).length])) as Record<DeliveryPipelineStatus, number>;
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const recentPaidOrders = orders.filter((order) => new Date(order.createdAt).getTime() >= thirtyDaysAgo && order.status !== "cancelled");
  const deliveredOrders = orders.filter((order) => order.deliveredAt && order.fulfilment);
  const deliveryDays = deliveredOrders.map((order) => (new Date(order.deliveredAt as string).getTime() - new Date(order.fulfilment?.shippedAt as string).getTime()) / 86_400_000).filter((days) => days >= 0);
  const attemptedCount = deliveredOrders.length + countsByStatus.failed;
  return {
    countsByStatus,
    feesCollectedLast30Days: { amountMinor: recentPaidOrders.reduce((sum, order) => sum + order.shippingFee.amountMinor, 0), currency: readMockDatabase().settings.currency },
    averageDeliveryDays: deliveryDays.length > 0 ? Math.round((deliveryDays.reduce((sum, days) => sum + days, 0) / deliveryDays.length) * 10) / 10 : null,
    failedDeliveryRateBasisPoints: attemptedCount > 0 ? Math.round((countsByStatus.failed * 10_000) / attemptedCount) : 0,
    onTimeRateBasisPoints: deliveredOrders.length > 0 ? 9_120 : 0,
  };
}

function validateDeliveryAreaBody(body: Record<string, unknown>): { issues: ValidationIssue[]; values: Omit<DeliveryArea, "id" | "fee"> & { feeMinor: number } } {
  const issues: ValidationIssue[] = [];
  const name = String(body.name ?? "").trim();
  const state = String(body.state ?? "").trim();
  const cities = Array.isArray(body.cities) ? [...new Set(body.cities.map((city) => String(city).trim()).filter(Boolean))] : [];
  const feeMinor = Number(body.feeMinor);
  const estimatedDaysMin = Number(body.estimatedDaysMin);
  const estimatedDaysMax = Number(body.estimatedDaysMax);
  if (name.length < 2 || name.length > 60) issues.push({ path: "name", message: "Name the area (2–60 characters)." });
  if (state.length < 2 || state.length > 40) issues.push({ path: "state", message: "Choose the state." });
  if (cities.length === 0 || cities.length > 40) issues.push({ path: "cities", message: "Add at least one city or town." });
  if (!Number.isSafeInteger(feeMinor) || feeMinor < 0 || feeMinor > 100_000_000) issues.push({ path: "feeMinor", message: "Enter a delivery fee of zero or more." });
  if (!Number.isInteger(estimatedDaysMin) || estimatedDaysMin < 0 || estimatedDaysMin > 30) issues.push({ path: "estimatedDaysMin", message: "Use 0–30 days." });
  if (!Number.isInteger(estimatedDaysMax) || estimatedDaysMax < estimatedDaysMin || estimatedDaysMax > 30) issues.push({ path: "estimatedDaysMax", message: "Must be at least the minimum and at most 30." });
  return { issues, values: { name, state, cities, feeMinor, estimatedDaysMin, estimatedDaysMax, active: body.active !== false } };
}

function registerDeliveryAreaHandlers(): void {
  registerMockRoute("GET", "/seller/delivery/areas", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: readDeliveryAreas(), nextCursor: null });
  });

  registerMockRoute("POST", "/seller/delivery/areas", (request) => {
    requireMockStorePrincipal(request);
    const { issues, values } = validateDeliveryAreaBody(readJsonObjectBody(request));
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const areas = readDeliveryAreas();
    if (areas.length >= 50) throw new MockHttpError(409, "AREA_LIMIT_REACHED", "You can have up to 50 delivery areas.");
    const { feeMinor, ...rest } = values;
    const area: DeliveryArea = { ...rest, id: createMockIdentifier("zone"), fee: { amountMinor: feeMinor, currency: readMockDatabase().settings.currency } };
    areas.push(area);
    return respondWithJson(201, area);
  });

  registerMockRoute("PATCH", "/seller/delivery/areas/:areaId", (request) => {
    requireMockStorePrincipal(request);
    const areas = readDeliveryAreas();
    const areaIndex = areas.findIndex((area) => area.id === request.params.areaId);
    const current = areas[areaIndex];
    if (!current) throw new MockHttpError(404, "AREA_NOT_FOUND", "That delivery area no longer exists.");
    const merged = { ...current, feeMinor: current.fee.amountMinor, ...readJsonObjectBody(request) };
    const { issues, values } = validateDeliveryAreaBody(merged);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const { feeMinor, ...rest } = values;
    const updated: DeliveryArea = { ...current, ...rest, fee: { amountMinor: feeMinor, currency: current.fee.currency } };
    areas[areaIndex] = updated;
    return respondWithJson(200, updated);
  });

  registerMockRoute("DELETE", "/seller/delivery/areas/:areaId", (request) => {
    requireMockStorePrincipal(request);
    const areas = readDeliveryAreas();
    const areaIndex = areas.findIndex((area) => area.id === request.params.areaId);
    if (areaIndex < 0) throw new MockHttpError(404, "AREA_NOT_FOUND", "That delivery area no longer exists.");
    areas.splice(areaIndex, 1);
    return respondWithNoContent();
  });
}

export function registerDeliveryMockHandlers(): void {
  registerMockRoute("GET", "/seller/delivery/summary", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, buildDeliverySummary());
  });

  registerMockRoute("GET", "/seller/delivery/shipments", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    if (status && status !== "all" && !pipelineStatuses.includes(status as DeliveryPipelineStatus)) return respondWithValidationFailure([{ path: "status", message: "Unknown delivery status." }]);
    const shipments = readMockDatabase().onlineOrders
      .filter((order) => (status && status !== "all" ? order.delivery.status === status : pipelineStatuses.includes(order.delivery.status as DeliveryPipelineStatus)))
      .filter((order) => matchesSearchText(request.query.get("q"), order.orderNumber, order.buyer.name, order.shippingAddress.city, order.fulfilment?.trackingNumber, order.delivery.riderName))
      .map(convertOrderToShipment);
    return respondWithJson(200, paginateMockList(shipments, request.query));
  });

  registerMockRoute("POST", "/seller/delivery/shipments/:orderId/attempts", (request) => {
    const principal = requireMockStorePrincipal(request);
    const orderIndex = findOrderIndexOrThrow(request.params.orderId ?? "");
    const order = readMockDatabase().onlineOrders[orderIndex] as OnlineOrder;
    const body = readJsonObjectBody(request);
    const outcome = body.outcome;
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
    if (outcome !== "delivered" && outcome !== "failed") return respondWithValidationFailure([{ path: "outcome", message: "Choose delivered or failed." }]);
    if (outcome === "failed" && note.length < 3) return respondWithValidationFailure([{ path: "note", message: "Say what went wrong so the team can follow up." }]);
    if (order.delivery.status !== "in_transit" && order.delivery.status !== "failed") throw new MockHttpError(409, "NOT_IN_TRANSIT", "Only parcels on the way can have a delivery attempt recorded.");
    const attempts = order.delivery.attempts + 1;
    const updated = outcome === "delivered"
      ? saveOrderWithTimelineEvent(orderIndex, { status: "delivered", deliveredAt: new Date().toISOString(), escrowReleaseAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), delivery: { ...order.delivery, status: "delivered", attempts, lastAttemptNote: note || null } }, buildTimelineEvent("delivered", "Delivered to the buyer", principal.actorName))
      : saveOrderWithTimelineEvent(orderIndex, { delivery: { ...order.delivery, status: "failed", attempts, lastAttemptNote: note } }, buildTimelineEvent("delivery_failed", `Delivery attempt ${attempts} failed: ${note}`, principal.actorName));
    return respondWithJson(200, convertOrderToShipment(updated));
  });

  registerMockRoute("PATCH", "/seller/delivery/shipments/:orderId", (request) => {
    requireMockStorePrincipal(request);
    const orderIndex = findOrderIndexOrThrow(request.params.orderId ?? "");
    const order = readMockDatabase().onlineOrders[orderIndex] as OnlineOrder;
    const body = readJsonObjectBody(request);
    const riderName = typeof body.riderName === "string" ? body.riderName.trim() : order.delivery.riderName;
    const riderPhone = typeof body.riderPhone === "string" ? body.riderPhone.trim() : order.delivery.riderPhone;
    const estimatedDeliveryAt = typeof body.estimatedDeliveryAt === "string" && !Number.isNaN(Date.parse(body.estimatedDeliveryAt)) ? new Date(body.estimatedDeliveryAt).toISOString() : order.delivery.estimatedDeliveryAt;
    const issues: ValidationIssue[] = [];
    if (riderName !== null && riderName.length > 0 && (riderName.length < 2 || riderName.length > 60)) issues.push({ path: "riderName", message: "Rider name must be 2–60 characters." });
    if (riderPhone && !/^\+?[0-9 ]{7,16}$/.test(riderPhone)) issues.push({ path: "riderPhone", message: "Enter a valid phone number." });
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const retryStatus = body.retry === true && order.delivery.status === "failed" ? "in_transit" : order.delivery.status;
    const updated = saveOrderWithTimelineEvent(orderIndex, { delivery: { ...order.delivery, status: retryStatus, riderName: riderName || null, riderPhone: riderPhone || null, estimatedDeliveryAt } }, null);
    return respondWithJson(200, convertOrderToShipment(updated));
  });

  registerDeliveryAreaHandlers();
}
