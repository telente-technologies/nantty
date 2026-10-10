import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { createMockId, failConflict, failValidation, matchesSearchText, paginateByCursor, readIsoNow, readJsonObjectBody, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

import { calculateRefundableMinor, findMockOrderOrFail, presentRefund } from "./moneyPresenters.mock";
import { calculateEscrowHeldMinor, postMockLedgerJournal, readMockMoneyStore, readUserSearchableText, requireIdempotencyKeyHeader } from "./moneyStore.mock";
import { appendEscrowTimelineEvent, readMoneyAmountInOrderCurrency, readPageFilterValue } from "./moneyValidation.mock";

export function registerRefundMockHandlers(): void {
  registerMockRoute("GET", "/admin/refunds", (request) => {
    requireMockPermission(request, "refunds:issue");
    const source = readPageFilterValue(request, "source");
    const status = readPageFilterValue(request, "status");
    const orderId = request.query.get("orderId");
    const search = request.query.get("search");
    const refunds = readMockMoneyStore()
      .refunds.filter((refund) => !orderId || refund.orderId === orderId)
      .filter((refund) => {
        const order = findMockOrderOrFail(refund.orderId);
        return matchesSearchText(search, refund.id, order.orderNumber, readUserSearchableText(order.buyerId), refund.reason);
      })
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .map(presentRefund)
      .filter((refund) => (!source || refund.source === source) && (!status || refund.status === status));
    return respondWithJson(200, paginateByCursor(refunds, request));
  });

  registerMockRoute("POST", "/admin/refunds", (request) => {
    requireMockPermission(request, "refunds:issue");
    requireMockStepUp(request);
    requireIdempotencyKeyHeader(request.headers);
    const body = readJsonObjectBody(request);
    const order = findMockOrderOrFail(readRequiredTrimmedString(body, "orderId", 64));
    const reason = readRequiredTrimmedString(body, "reason", 1000, 5);
    if (order.status === "DISPUTED") failConflict("DISPUTE_OPEN", "This order has an open dispute. Resolve the dispute instead.");
    const refundableMinor = calculateRefundableMinor(order);
    if (refundableMinor <= 0) failConflict("NOTHING_REFUNDABLE", "Nothing is left in escrow for this order.");
    const amountMinor = readMoneyAmountInOrderCurrency(body, "amount", order.currency);
    if (amountMinor > refundableMinor) failValidation("amount.amountMinor", "cannot be more than the refundable amount");
    if (order.escrowStatus === "RELEASED" && amountMinor !== refundableMinor) failValidation("amount.amountMinor", "a released order can only be refunded in full");
    const before = { orderStatus: order.status, escrowStatus: order.escrowStatus, escrowHeld: { amountMinor: calculateEscrowHeldMinor(order), currency: order.currency } };
    const store = readMockMoneyStore();
    const refund = { id: createMockId("rfd"), orderId: order.id, amountMinor, currency: order.currency, source: "MANUAL" as const, reason, createdAt: readIsoNow(), createdByName: request.principal?.name ?? "System", status: "PROCESSING" as const };
    store.refunds.unshift(refund);
    postMockLedgerJournal(store, { currency: order.currency, description: `Manual refund to buyer for ${order.orderNumber}`, reference: { type: "REFUND", id: refund.id, label: order.orderNumber }, legs: [{ accountId: "escrow_holding", direction: "DEBIT", amountMinor }, { accountId: "provider_clearing", direction: "CREDIT", amountMinor }] });
    order.refundedMinor += amountMinor;
    const isFullRefund = amountMinor === refundableMinor;
    order.status = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";
    if (isFullRefund) order.escrowStatus = "REFUNDED";
    order.autoReleaseAt = isFullRefund ? null : order.autoReleaseAt;
    appendEscrowTimelineEvent(order, request, isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED", `Manual refund ${refund.id}.`, amountMinor);
    const after = { orderStatus: order.status, escrowStatus: order.escrowStatus, refund: { amountMinor, currency: order.currency }, escrowHeld: { amountMinor: calculateEscrowHeldMinor(order), currency: order.currency } };
    recordMockAuditEntry(request, { action: "refund.issued", area: "commerce", target: { type: "order", id: order.id, label: order.orderNumber }, reason, before, after });
    return respondWithJson(201, presentRefund(refund));
  });
}
