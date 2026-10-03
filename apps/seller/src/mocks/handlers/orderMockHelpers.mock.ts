import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import type { MockPrincipal } from "@/mocks/mockRouter.mock";
import type { OnlineOrder, OrderTimelineEvent } from "@/types/order.type";

export function buildMockAuditActor(principal: MockPrincipal) {
  return { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" };
}

export function findOrderIndexOrThrow(orderId: string): number {
  const orderIndex = readMockDatabase().onlineOrders.findIndex((order) => order.id === orderId);
  if (orderIndex < 0) throw new MockHttpError(404, "ORDER_NOT_FOUND", "That order does not exist in your store.");
  return orderIndex;
}

export function buildTimelineEvent(kind: OrderTimelineEvent["kind"], summary: string, actorName: string | null): OrderTimelineEvent {
  return { id: `tl_${crypto.randomUUID().slice(0, 12)}`, kind, summary, actorName, createdAt: new Date().toISOString() };
}

export function saveOrderWithTimelineEvent(orderIndex: number, changes: Partial<OnlineOrder>, event: OrderTimelineEvent | null): OnlineOrder {
  const database = readMockDatabase();
  const current = database.onlineOrders[orderIndex] as OnlineOrder;
  const updated: OnlineOrder = { ...current, ...changes, timeline: event ? [...current.timeline, event] : current.timeline };
  database.onlineOrders[orderIndex] = updated;
  return updated;
}

export function isOrderAwaitingShipment(order: OnlineOrder): boolean {
  return order.status === "new" || order.status === "processing" || order.status === "ready";
}
