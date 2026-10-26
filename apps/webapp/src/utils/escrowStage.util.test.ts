import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EscrowDetail } from "@/types/commerce.type";

import { buildEscrowTimelineSteps, describeEscrowRelease, escrowActionsForViewer, isDisputeDraftReady } from "./escrowStage.util";

const money = { amountMinor: 1_000_000, currency: "NGN" as const };
const escrow = (overrides: Partial<EscrowDetail>): EscrowDetail => ({
  orderId: "o1", orderReference: "ZM-1", stage: "shipped", heldAmount: money, platformFee: { amountMinor: 50_000, currency: "NGN" as const }, sellerPayoutAmount: { amountMinor: 950_000, currency: "NGN" as const },
  buyer: { id: "b", name: "Bola", username: "bola", avatarUrl: null } as EscrowDetail["buyer"], store: { id: "s", name: "Ada Styles" } as EscrowDetail["store"], sellerUserId: "seller",
  paidAt: "2026-10-01T10:00:00Z", preparingSince: null, shipment: { courierName: "GIG", trackingNumber: "T1", trackingUrl: null, shippedAt: "2026-10-02T10:00:00Z", estimatedDeliveryAt: null },
  deliveredAt: null, buyerConfirmedAt: null, autoReleaseAt: null, expectedReleaseAt: null, releasedAt: null, refundedAt: null, disputeId: null, ...overrides,
});

describe("escrow actions", () => {
  it("lets the buyer confirm or dispute a shipped order, and only the seller ship", () => {
    assert.deepEqual(escrowActionsForViewer(escrow({}), "buyer"), { canConfirmReceipt: true, canOpenDispute: true, canMarkShipped: false });
    assert.deepEqual(escrowActionsForViewer(escrow({ stage: "seller_preparing" }), "seller"), { canConfirmReceipt: false, canOpenDispute: false, canMarkShipped: true });
    assert.equal(escrowActionsForViewer(escrow({ disputeId: "d1" }), "buyer").canOpenDispute, false);
    assert.equal(escrowActionsForViewer(escrow({ stage: "released_to_seller" }), "buyer").canOpenDispute, false);
  });

  it("shows an undelivered order under staff review without a release date, and still lets the buyer dispute it", () => {
    const reviewed = escrow({ stage: "under_review", undeliveredReviewAt: "2026-11-01T10:00:00Z" });
    assert.equal(describeEscrowRelease(reviewed), "Under review by Nantty staff. The seller isn't paid until it's settled");
    assert.deepEqual(escrowActionsForViewer(reviewed, "buyer"), { canConfirmReceipt: true, canOpenDispute: true, canMarkShipped: false });
    const steps = buildEscrowTimelineSteps(reviewed, "buyer");
    assert.equal(steps.find((step) => step.state === "problem")?.title, "Not delivered after 30 days — under review");
  });

  it("tells the buyer which fees were kept on a refund after the seller was paid", () => {
    const refunded = escrow({ stage: "refunded", refundedAmount: { amountMinor: 971_000, currency: "NGN" }, feesKeptOnRefund: { amountMinor: 29_000, currency: "NGN" } });
    const detail = buildEscrowTimelineSteps(refunded, "buyer").find((step) => step.state === "problem")?.detail ?? "";
    assert.match(detail, /returned to the buyer\. The seller had already been paid, so Nantty kept its .*290.* fees/);
  });

  it("inserts a paused step while a dispute is open", () => {
    const steps = buildEscrowTimelineSteps(escrow({ stage: "disputed" }), "buyer");
    const problem = steps.findIndex((step) => step.state === "problem");
    assert.equal(steps[problem]?.title, "Dispute open — release paused");
    assert.ok(steps.every((step) => step.state !== "current"));
    assert.equal(describeEscrowRelease(escrow({ stage: "disputed" })), "Release paused while the dispute is reviewed");
  });
});

describe("dispute draft", () => {
  it("needs a reason, 20 characters and photos for damage, and waits for uploads", () => {
    const description = "The strap snapped on day one.";
    assert.equal(isDisputeDraftReady({ reason: null, description, evidenceCount: 1, uploading: false }), false);
    assert.equal(isDisputeDraftReady({ reason: "damaged", description, evidenceCount: 0, uploading: false }), false);
    assert.equal(isDisputeDraftReady({ reason: "damaged", description, evidenceCount: 1, uploading: true }), false);
    assert.equal(isDisputeDraftReady({ reason: "not_received", description: "too short", evidenceCount: 0, uploading: false }), false);
    assert.equal(isDisputeDraftReady({ reason: "not_received", description, evidenceCount: 0, uploading: false }), true);
  });
});
