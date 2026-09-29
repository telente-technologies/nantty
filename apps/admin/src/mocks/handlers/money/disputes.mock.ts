import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { createMockId, failConflict, failNotFound, failValidation, matchesSearchText, paginateItems, readEnumValue, readIsoNow, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { DisputeOutcome, DisputeStatus } from "@/types/commerce.type";

import type { MockDisputeRecord } from "./moneyRecords.mock";
import { findMockOrderOrFail, presentDisputeDetail, presentDisputeSummary } from "./moneyPresenters.mock";
import { calculateCommissionInMinorUnits, calculateEscrowHeldMinor, postMockLedgerJournal, readMockMoneyStore, readUserSearchableText, requireIdempotencyKeyHeader } from "./moneyStore.mock";
import { appendEscrowTimelineEvent, readMoneyAmountInOrderCurrency, readPageFilterValue } from "./moneyValidation.mock";

const disputeStatuses: readonly DisputeStatus[] = ["OPEN", "AWAITING_SELLER", "IN_REVIEW", "RESOLVED"];
const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2 } as const;

function findMockDisputeOrFail(disputeId: string): MockDisputeRecord {
  const dispute = readMockMoneyStore().disputes.find((candidate) => candidate.id === disputeId);
  if (!dispute) failNotFound("Dispute");
  return dispute;
}

function settleDisputeEscrow(request: MockRequest, dispute: MockDisputeRecord, outcome: DisputeOutcome, requestedRefundMinor: number | null, reason: string) {
  const store = readMockMoneyStore();
  const order = findMockOrderOrFail(dispute.orderId);
  const heldMinor = calculateEscrowHeldMinor(order);
  if (heldMinor <= 0) failConflict("ESCROW_EMPTY", "There is no money left in escrow for this order.");
  const refundMinor = outcome === "REFUND_FULL" ? heldMinor : outcome === "RELEASE_TO_SELLER" ? 0 : (requestedRefundMinor ?? 0);
  if (outcome === "REFUND_PARTIAL" && (refundMinor <= 0 || refundMinor >= heldMinor)) failValidation("refundAmount.amountMinor", "A partial refund must be more than zero and less than the amount in escrow.");
  const sellerPortionMinor = heldMinor - refundMinor;
  const commissionMinor = calculateCommissionInMinorUnits(sellerPortionMinor, order.commissionBasisPoints);
  const reference = { type: "DISPUTE" as const, id: dispute.id, label: `${dispute.id} · ${order.orderNumber}` };

  if (refundMinor > 0) {
    postMockLedgerJournal(store, { currency: order.currency, description: `Dispute refund to buyer for ${order.orderNumber}`, reference, legs: [{ accountId: "escrow_holding", direction: "DEBIT", amountMinor: refundMinor }, { accountId: "provider_clearing", direction: "CREDIT", amountMinor: refundMinor }] });
    store.refunds.unshift({ id: createMockId("rfd"), orderId: order.id, amountMinor: refundMinor, currency: order.currency, source: "DISPUTE", reason, createdAt: readIsoNow(), createdByName: request.principal?.name ?? "System", status: "PROCESSING" });
  }
  if (sellerPortionMinor > 0) {
    postMockLedgerJournal(store, {
      currency: order.currency,
      description: `Dispute release to seller for ${order.orderNumber}`,
      reference,
      legs: [
        { accountId: "escrow_holding", direction: "DEBIT", amountMinor: sellerPortionMinor },
        { accountId: `user_wallet:${order.sellerId}`, direction: "CREDIT", amountMinor: sellerPortionMinor - commissionMinor },
        { accountId: "platform_commission", direction: "CREDIT", amountMinor: commissionMinor },
      ],
    });
  }
  order.refundedMinor += refundMinor;
  order.escrowStatus = outcome === "REFUND_FULL" ? "REFUNDED" : outcome === "REFUND_PARTIAL" ? "PARTIALLY_REFUNDED" : "RELEASED";
  order.status = outcome === "REFUND_FULL" ? "REFUNDED" : outcome === "REFUND_PARTIAL" ? "PARTIALLY_REFUNDED" : "COMPLETED";
  const timelineKind = outcome === "REFUND_FULL" ? "REFUNDED" : outcome === "REFUND_PARTIAL" ? "PARTIALLY_REFUNDED" : "RELEASED";
  appendEscrowTimelineEvent(order, request, timelineKind, `Dispute ${dispute.id} resolved: ${outcome.toLowerCase().replace(/_/g, " ")}.`, refundMinor > 0 ? refundMinor : sellerPortionMinor);
  return { heldMinor, refundMinor, sellerPayoutMinor: sellerPortionMinor - commissionMinor, commissionMinor, order };
}

export function registerDisputeMockHandlers(): void {
  registerMockRoute("GET", "/admin/disputes", (request) => {
    requireMockPermission(request, "disputes:resolve");
    const store = readMockMoneyStore();
    const status = readPageFilterValue(request, "status");
    const search = request.query.get("search");
    const disputes = store.disputes
      .filter((dispute) => !status || dispute.status === status)
      .filter((dispute) => {
        const order = findMockOrderOrFail(dispute.orderId);
        return matchesSearchText(search, dispute.id, order.orderNumber, order.storeName, readUserSearchableText(order.buyerId), readUserSearchableText(order.sellerId));
      })
      .sort((first, second) => priorityRank[first.priority] - priorityRank[second.priority] || first.slaDueAt.localeCompare(second.slaDueAt))
      .map(presentDisputeSummary);
    const counts = Object.fromEntries(disputeStatuses.map((candidate) => [candidate, store.disputes.filter((dispute) => dispute.status === candidate).length]));
    return respondWithJson(200, { ...paginateItems(disputes, request), counts });
  });

  registerMockRoute("GET", "/admin/disputes/:disputeId", (request) => {
    requireMockPermission(request, "disputes:resolve");
    return respondWithJson(200, presentDisputeDetail(findMockDisputeOrFail(request.params.disputeId ?? "")));
  });

  registerMockRoute("POST", "/admin/disputes/:disputeId/resolve", (request) => {
    requireMockPermission(request, "disputes:resolve");
    requireMockStepUp(request);
    requireIdempotencyKeyHeader(request.headers);
    const dispute = findMockDisputeOrFail(request.params.disputeId ?? "");
    if (dispute.status === "RESOLVED") failConflict("DISPUTE_ALREADY_RESOLVED", "This dispute has already been resolved.");
    const body = readJsonObjectBody(request);
    const outcome = readEnumValue(body, "outcome", ["REFUND_FULL", "REFUND_PARTIAL", "RELEASE_TO_SELLER"] as const);
    const reason = readRequiredReason(body);
    const order = findMockOrderOrFail(dispute.orderId);
    const requestedRefundMinor = outcome === "REFUND_PARTIAL" ? readMoneyAmountInOrderCurrency(body, "refundAmount", order.currency) : null;
    const before = { disputeStatus: dispute.status, orderStatus: order.status, escrowStatus: order.escrowStatus, escrowHeld: { amountMinor: calculateEscrowHeldMinor(order), currency: order.currency } };
    const settlement = settleDisputeEscrow(request, dispute, outcome, requestedRefundMinor, reason);
    dispute.status = "RESOLVED";
    dispute.resolution = { outcome, buyerRefundMinor: settlement.refundMinor, sellerPayoutMinor: settlement.sellerPayoutMinor, commissionMinor: settlement.commissionMinor, reason, resolvedAt: readIsoNow(), resolvedByName: request.principal?.name ?? "System" };
    const after = {
      disputeStatus: dispute.status, orderStatus: order.status, escrowStatus: order.escrowStatus, outcome,
      buyerRefund: { amountMinor: settlement.refundMinor, currency: order.currency },
      sellerPayout: { amountMinor: settlement.sellerPayoutMinor, currency: order.currency },
      commission: { amountMinor: settlement.commissionMinor, currency: order.currency },
    };
    recordMockAuditEntry(request, { action: "dispute.resolved", area: "commerce", target: { type: "dispute", id: dispute.id, label: `${dispute.id} · ${order.orderNumber}` }, reason, before, after });
    recordMockAuditEntry(request, { action: "escrow.settled", area: "commerce", target: { type: "order", id: order.id, label: order.orderNumber }, reason, before, after });
    return respondWithJson(200, presentDisputeDetail(dispute));
  });
}
