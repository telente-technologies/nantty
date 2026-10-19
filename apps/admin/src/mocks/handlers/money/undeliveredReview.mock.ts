import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockSingleUseStepUp } from "@/mocks/mockGuards.mock";
import { failConflict, failValidation, paginateByCursor, readJsonObjectBody, readOptionalTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { UndeliveredReviewRow } from "@/types/commerce.type";

import { requireIdempotencyKeyHeader } from "./moneyStore.mock";

type ReviewStatus = "held" | "released" | "refunded";
interface MockReviewRecord extends UndeliveredReviewRow {
  status: ReviewStatus;
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
let reviewRecords: MockReviewRecord[] | null = null;

function readReviewRecords(): MockReviewRecord[] {
  reviewRecords ??= [
    { escrowId: "esc_review_1", orderId: "ord_review_1", orderReference: "ZM-30117", buyerUserId: "usr_buyer_review_1", sellerUserId: "usr_seller_review_1", storeId: "sto_review_1", heldAmount: { amountMinor: 4_500_000, currency: "NGN" }, heldSince: daysAgo(33), reviewSince: daysAgo(3), shippedAt: daysAgo(31), courierName: "GIG Logistics", trackingNumber: "GIG-882104", status: "held" },
    { escrowId: "esc_review_2", orderId: "ord_review_2", orderReference: "ZM-30244", buyerUserId: "usr_buyer_review_2", sellerUserId: "usr_seller_review_2", storeId: "sto_review_2", heldAmount: { amountMinor: 1_250_000, currency: "NGN" }, heldSince: daysAgo(31), reviewSince: daysAgo(1), shippedAt: null, courierName: "", trackingNumber: "", status: "held" },
    { escrowId: "esc_review_3", orderId: "ord_review_3", orderReference: "ZM-30391", buyerUserId: "usr_buyer_review_3", sellerUserId: "usr_seller_review_3", storeId: "sto_review_3", heldAmount: { amountMinor: 18_000, currency: "GHS" }, heldSince: daysAgo(30), reviewSince: daysAgo(0), shippedAt: null, courierName: "", trackingNumber: "", status: "held" },
  ];
  return reviewRecords;
}

const presentRow = ({ status: _status, ...row }: MockReviewRecord): UndeliveredReviewRow => row;

function decide(request: MockRequest, outcome: Exclude<ReviewStatus, "held">) {
  requireMockPermission(request, "disputes:resolve");
  requireMockSingleUseStepUp(request);
  requireIdempotencyKeyHeader(request.headers);
  const reason = readOptionalTrimmedString(readJsonObjectBody(request), "reason", 300) ?? "";
  if (reason.length < 3) failValidation("reason", "must be between 3 and 300 characters");
  const record = readReviewRecords().find((candidate) => candidate.orderId === request.params.orderId);
  if (!record || record.status !== "held") failConflict("ESCROW_NOT_UNDER_REVIEW", "This order is not waiting for a staff review.");
  record.status = outcome;
  recordMockAuditEntry(request, { action: outcome === "released" ? "escrow.releasedAfterReview" : "escrow.refundedAfterReview", area: "money", target: { type: "order", id: record.orderId, label: record.orderReference }, reason, before: { status: "held" }, after: { status: outcome } });
  return respondWithJson(200, { escrowId: record.escrowId, orderId: record.orderId, orderReference: record.orderReference, status: outcome, heldAmount: record.heldAmount });
}

export function registerUndeliveredReviewMockHandlers(): void {
  registerMockRoute("GET", "/admin/escrows/undelivered-review", (request) => {
    requireMockPermission(request, "disputes:resolve");
    return respondWithJson(200, paginateByCursor(readReviewRecords().filter((record) => record.status === "held").map(presentRow), request));
  });
  registerMockRoute("POST", "/admin/orders/:orderId/escrow/release", (request) => decide(request, "released"));
  registerMockRoute("POST", "/admin/orders/:orderId/escrow/refund", (request) => decide(request, "refunded"));
}
