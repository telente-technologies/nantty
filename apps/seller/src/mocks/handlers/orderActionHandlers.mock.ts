import { findOrCreateConversationForOrder } from "@/mocks/handlers/conversationMockStore.mock";
import { buildMockAuditActor, buildTimelineEvent, findOrderIndexOrThrow, saveOrderWithTimelineEvent } from "@/mocks/handlers/orderMockHelpers.mock";
import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { runOnceForIdempotencyKey } from "@/mocks/mockIdempotency.mock";
import { MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { OnlineOrder, OnlineOrderStatus } from "@/types/order.type";

const allowedManualTransitions: Partial<Record<OnlineOrderStatus, OnlineOrderStatus[]>> = {
  new: ["processing"],
  processing: ["ready"],
  ready: ["processing"],
  shipped: ["delivered"],
};

function readOrderForAction(request: MockRequest): { orderIndex: number; order: OnlineOrder } {
  const orderIndex = findOrderIndexOrThrow(request.params.orderId ?? "");
  return { orderIndex, order: readMockDatabase().onlineOrders[orderIndex] as OnlineOrder };
}

function recordOrderAudit(request: MockRequest, action: string, order: OnlineOrder, summary: string): void {
  appendMockAuditLogEntry({ actor: buildMockAuditActor(requireMockStorePrincipal(request)), action, targetType: "order", targetId: order.id, summary });
}

function registerOrderDecisionHandlers(): void {
  registerMockRoute("POST", "/seller/orders/:orderId/accept", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { orderIndex, order } = readOrderForAction(request);
    if (order.status !== "new") throw new MockHttpError(409, "ORDER_NOT_NEW", "Only new orders can be accepted.");
    const updated = saveOrderWithTimelineEvent(orderIndex, { status: "processing", delivery: { ...order.delivery, status: "preparing" } }, buildTimelineEvent("accepted", "Order accepted", principal.actorName));
    recordOrderAudit(request, "order.accepted", order, `Accepted ${order.orderNumber}`);
    return respondWithJson(200, updated);
  });

  registerMockRoute("POST", "/seller/orders/:orderId/reject", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { orderIndex, order } = readOrderForAction(request);
    const reason = String(readJsonObjectBody(request).reason ?? "").trim();
    if (reason.length < 5 || reason.length > 500) return respondWithValidationFailure([{ path: "reason", message: "Tell the buyer why (5–500 characters)." }]);
    if (order.status !== "new") throw new MockHttpError(409, "ORDER_NOT_NEW", "Only new orders can be rejected. Cancel accepted orders instead.");
    const refund = { id: `rf_${crypto.randomUUID().slice(0, 10)}`, amount: order.total, reason, createdAt: new Date().toISOString() };
    const updated = saveOrderWithTimelineEvent(
      orderIndex,
      { status: "cancelled", escrowStatus: "refunded", paymentStatus: "refunded", refundedAmount: order.total, refunds: [...order.refunds, refund], delivery: { ...order.delivery, status: "cancelled" } },
      buildTimelineEvent("rejected", `Rejected: ${reason}`, principal.actorName),
    );
    recordOrderAudit(request, "order.rejected", order, `Rejected ${order.orderNumber}: ${reason}`);
    return respondWithJson(200, updated);
  });

  registerMockRoute("POST", "/seller/orders/:orderId/status", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { orderIndex, order } = readOrderForAction(request);
    const nextStatus = readJsonObjectBody(request).status as OnlineOrderStatus;
    if (!allowedManualTransitions[order.status]?.includes(nextStatus)) throw new MockHttpError(409, "INVALID_STATUS_CHANGE", `An order that is ${order.status} cannot move to ${String(nextStatus)} here.`);
    const now = new Date().toISOString();
    const changesByStatus: Partial<Record<OnlineOrderStatus, Partial<OnlineOrder>>> = {
      processing: { status: "processing", delivery: { ...order.delivery, status: "preparing" } },
      ready: { status: "ready", delivery: { ...order.delivery, status: "ready_for_pickup" } },
      delivered: { status: "delivered", deliveredAt: now, escrowReleaseAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), delivery: { ...order.delivery, status: "delivered", attempts: order.delivery.attempts + 1, lastAttemptNote: null } },
    };
    const summaries: Partial<Record<OnlineOrderStatus, string>> = { processing: "Moved back to processing", ready: "Packed and ready for pickup", delivered: "Marked as delivered — escrow releases in 3 days unless the buyer reports a problem" };
    const updated = saveOrderWithTimelineEvent(orderIndex, changesByStatus[nextStatus] ?? {}, buildTimelineEvent(nextStatus === "delivered" ? "delivered" : nextStatus === "ready" ? "ready" : "processing", summaries[nextStatus] ?? "Status updated", principal.actorName));
    recordOrderAudit(request, "order.status_changed", order, `Moved ${order.orderNumber} to ${nextStatus}`);
    return respondWithJson(200, updated);
  });
}

function registerOrderNoteRefundAndContactHandlers(): void {
  registerMockRoute("POST", "/seller/orders/:orderId/notes", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { orderIndex, order } = readOrderForAction(request);
    const body = String(readJsonObjectBody(request).body ?? "").trim();
    if (body.length < 2 || body.length > 1000) return respondWithValidationFailure([{ path: "body", message: "Write a note of 2–1000 characters." }]);
    const note = { id: `note_${crypto.randomUUID().slice(0, 10)}`, body, authorName: principal.actorName, createdAt: new Date().toISOString() };
    const updated = saveOrderWithTimelineEvent(orderIndex, { notes: [...order.notes, note] }, null);
    return respondWithJson(201, updated);
  });

  registerMockRoute("POST", "/seller/orders/:orderId/refunds", (request) =>
    runOnceForIdempotencyKey(request, () => {
      const principal = requireMockStorePrincipal(request);
      const { orderIndex, order } = readOrderForAction(request);
      const body = readJsonObjectBody(request);
      const amountMinor = Number(body.amountMinor);
      const reason = String(body.reason ?? "").trim();
      const refundableMinor = order.total.amountMinor - order.refundedAmount.amountMinor;
      const issues: { path: string; message: string }[] = [];
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) issues.push({ path: "amountMinor", message: "Enter an amount above zero." });
      else if (amountMinor > refundableMinor) issues.push({ path: "amountMinor", message: "You cannot refund more than the buyer paid." });
      if (reason.length < 5 || reason.length > 500) issues.push({ path: "reason", message: "Tell the buyer why (5–500 characters)." });
      if (issues.length > 0) return respondWithValidationFailure(issues);
      if (order.status === "cancelled" || order.status === "refunded" || order.status === "disputed") throw new MockHttpError(409, "ORDER_NOT_REFUNDABLE", order.status === "disputed" ? "Nantty decides refunds while a dispute is open." : "This order has already been refunded.");
      const isFullRefund = amountMinor === refundableMinor;
      const refundedAmount = { amountMinor: order.refundedAmount.amountMinor + amountMinor, currency: order.total.currency };
      const refund = { id: `rf_${crypto.randomUUID().slice(0, 10)}`, amount: { amountMinor, currency: order.total.currency }, reason, createdAt: new Date().toISOString() };
      const updated = saveOrderWithTimelineEvent(
        orderIndex,
        { refundedAmount, refunds: [...order.refunds, refund], paymentStatus: isFullRefund ? "refunded" : "partially_refunded", ...(isFullRefund ? { status: "refunded" as const, escrowStatus: "refunded" as const } : {}) },
        buildTimelineEvent("refunded", `${isFullRefund ? "Full" : "Partial"} refund sent to the buyer: ${reason}`, principal.actorName),
      );
      recordOrderAudit(request, "order.refunded", order, `Refunded ${order.orderNumber}`);
      return respondWithJson(201, updated);
    }),
  );

  registerMockRoute("POST", "/seller/orders/:orderId/conversation", (request) => {
    requireMockStorePrincipal(request);
    const { orderIndex, order } = readOrderForAction(request);
    const conversation = findOrCreateConversationForOrder(order);
    if (order.conversationId !== conversation.id) saveOrderWithTimelineEvent(orderIndex, { conversationId: conversation.id }, null);
    return respondWithJson(200, conversation);
  });
}

export function registerOrderActionMockHandlers(): void {
  registerOrderDecisionHandlers();
  registerOrderNoteRefundAndContactHandlers();
}
