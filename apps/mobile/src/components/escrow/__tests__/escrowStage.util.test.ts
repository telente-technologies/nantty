import type { EscrowDetail } from "@/types/commerce.type";

import { describeEscrowRelease, escrowPausedStepCopy, ESCROW_STAGE_APPEARANCE, STAGES_BUYER_CAN_CONFIRM, STAGES_BUYER_CAN_DISPUTE } from "../escrowStage.util";

const money = { amountMinor: 1_000_000, currency: "NGN" as const };
const escrow = (overrides: Partial<EscrowDetail>): EscrowDetail => ({
  orderId: "o1", orderReference: "ZM-1", stage: "shipped", heldAmount: money, platformFee: money, sellerPayoutAmount: money,
  paidAt: "2026-10-01T10:00:00Z", deliveredAt: null, buyerConfirmedAt: null, autoReleaseAt: null, expectedReleaseAt: null, releasedAt: null, refundedAt: null, disputeId: null, ...overrides,
} as EscrowDetail);

describe("undelivered order under staff review", () => {
  it("matches the web copy and keeps the buyer's confirm and dispute actions", () => {
    const reviewed = escrow({ stage: "under_review" });
    expect(ESCROW_STAGE_APPEARANCE.under_review.label).toBe("Under review");
    expect(describeEscrowRelease(reviewed)).toBe("Under review by Nantty staff. The seller isn't paid until it's settled");
    expect(escrowPausedStepCopy(reviewed).title).toBe("Not delivered after 30 days — under review");
    expect(STAGES_BUYER_CAN_CONFIRM.has("under_review")).toBe(true);
    expect(STAGES_BUYER_CAN_DISPUTE.has("under_review")).toBe(true);
  });

  it("tells the buyer which fees were kept on a refund after the seller was paid", () => {
    const refunded = escrow({ stage: "refunded", refundedAmount: { amountMinor: 971_000, currency: "NGN" }, feesKeptOnRefund: { amountMinor: 29_000, currency: "NGN" } } as Partial<EscrowDetail>);
    expect(escrowPausedStepCopy(refunded).detail).toMatch(/returned to the buyer\. The seller had already been paid, so Nantty kept its .*290.* fees/);
  });

  it("keeps the dispute copy", () => {
    expect(describeEscrowRelease(escrow({ stage: "disputed" }))).toBe("Release paused while the dispute is reviewed");
    expect(escrowPausedStepCopy(escrow({ stage: "disputed" })).title).toBe("Dispute open — release paused");
  });
});
