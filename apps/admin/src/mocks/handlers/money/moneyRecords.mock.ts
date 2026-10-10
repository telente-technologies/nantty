import type { CoinReviewStatus, CoinTransactionKind } from "@/types/coins.type";
import type { DisputeOutcome } from "@/types/commerce.type";
import type { LedgerAccountKind } from "@/types/ledger.type";
import type { WithdrawalStatus } from "@/types/withdrawals.type";

export type MockOrderStatus = "PAID" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "DISPUTED";
export type MockEscrowStatus = "FUNDED" | "HELD" | "RELEASED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "DISPUTED";
export type MockDeliveryStatus = "AWAITING_SHIPMENT" | "IN_TRANSIT" | "DELIVERED" | "RETURNED" | "CANCELLED";
export type MockDisputeStatus = "OPEN" | "AWAITING_SELLER" | "IN_REVIEW" | "RESOLVED";

export interface MockEscrowTimelineEvent {
  readonly id: string;
  readonly kind: "FUNDED" | "HELD" | "SHIPPED" | "DELIVERED" | "AUTO_RELEASE_SCHEDULED" | "DISPUTED" | "RELEASED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  readonly occurredAt: string;
  readonly actorName: string;
  readonly actorKind: "BUYER" | "SELLER" | "ADMIN" | "SYSTEM";
  readonly note: string | null;
  readonly amount: { readonly amountMinor: number; readonly currency: string } | null;
}

export interface MockDisputeEvidence {
  readonly id: string;
  readonly imageUrl: string;
  readonly caption: string;
  readonly submittedBy: "BUYER" | "SELLER";
}

export interface MockDisputeMessage {
  readonly id: string;
  readonly authorName: string;
  readonly authorRole: "BUYER" | "SELLER" | "ADMIN";
  readonly body: string;
  readonly sentAt: string;
}

export interface MockOrderItemRecord {
  readonly id: string;
  readonly productName: string;
  readonly imageUrl: string | null;
  readonly quantity: number;
  readonly unitPriceMinor: number;
}

export interface MockOrderRecord {
  readonly id: string;
  readonly orderNumber: string;
  readonly buyerId: string;
  readonly sellerId: string;
  readonly storeName: string;
  readonly currency: string;
  readonly items: readonly MockOrderItemRecord[];
  readonly deliveryFeeMinor: number;
  readonly commissionBasisPoints: number;
  readonly deliveryCity: string;
  readonly courier: string | null;
  readonly trackingNumber: string | null;
  readonly placedAt: string;
  status: MockOrderStatus;
  deliveryStatus: MockDeliveryStatus;
  escrowStatus: MockEscrowStatus;
  autoReleaseAt: string | null;
  timeline: MockEscrowTimelineEvent[];
  refundedMinor: number;
  disputeId: string | null;
}

export interface MockDisputeResolutionRecord {
  readonly outcome: DisputeOutcome;
  readonly buyerRefundMinor: number;
  readonly sellerPayoutMinor: number;
  readonly commissionMinor: number;
  readonly reason: string;
  readonly resolvedAt: string;
  readonly resolvedByName: string;
}

export interface MockDisputeRecord {
  readonly id: string;
  readonly orderId: string;
  readonly reasonCategory: string;
  readonly priority: "NORMAL" | "HIGH" | "URGENT";
  readonly openedAt: string;
  readonly slaDueAt: string;
  readonly buyerClaim: string;
  readonly sellerResponse: string | null;
  readonly evidence: readonly MockDisputeEvidence[];
  readonly messages: MockDisputeMessage[];
  status: MockDisputeStatus;
  resolution: MockDisputeResolutionRecord | null;
}

export interface MockRefundRecord {
  readonly id: string;
  readonly orderId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly source: "DISPUTE" | "MANUAL";
  readonly reason: string;
  readonly createdAt: string;
  readonly createdByName: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
}

export interface MockWithdrawalRecord {
  readonly id: string;
  readonly reference: string;
  readonly userId: string;
  readonly amountMinor: number;
  readonly feeMinor: number;
  readonly currency: string;
  readonly provider: string;
  readonly destination: { readonly payoutAccountId: string; readonly bankName: string; readonly accountLast4: string; readonly accountName: string; readonly countryCode: string; readonly addedAt: string; readonly removed: boolean };
  readonly createdAt: string;
  availableBalanceMinor: number;
  withdrawalStatus: WithdrawalStatus;
  failureReason: string | null;
  processedAt: string | null;
  reviewedByStaffId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface MockCoinRecord {
  readonly id: string;
  readonly kind: CoinTransactionKind;
  readonly senderId: string;
  readonly receiverId: string | null;
  readonly coins: number;
  readonly feeCoins: number | null;
  readonly feeBasisPoints: number | null;
  readonly fiatMinor: number | null;
  readonly currency: string;
  readonly reference: string | null;
  readonly paymentProvider: string | null;
  readonly channel: string | null;
  readonly reviewFlags: readonly string[];
  readonly flags: readonly string[];
  readonly createdAt: string;
  transactionStatus: string;
  reviewStatus: CoinReviewStatus;
  reviewedAt: string | null;
  reviewedByStaffId: string | null;
  reviewNote: string | null;
  clawbackShortfallCoins: number;
}

export interface MockLedgerAccountRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: LedgerAccountKind;
  readonly currency: string;
  readonly ownerUserId: string | null;
}

export interface MockJournalLegRecord {
  readonly accountId: string;
  readonly direction: "DEBIT" | "CREDIT";
  readonly amountMinor: number;
}

export interface MockJournalRecord {
  readonly id: string;
  readonly occurredAt: string;
  readonly description: string;
  readonly currency: string;
  readonly reference: { readonly type: "ORDER" | "PAYOUT" | "DISPUTE" | "REFUND" | "COIN"; readonly id: string; readonly label: string };
  readonly legs: readonly MockJournalLegRecord[];
}

export interface MockMoneyStore {
  readonly orders: MockOrderRecord[];
  readonly disputes: MockDisputeRecord[];
  readonly refunds: MockRefundRecord[];
  readonly withdrawals: MockWithdrawalRecord[];
  readonly coinTransactions: MockCoinRecord[];
  readonly ledgerAccounts: Map<string, MockLedgerAccountRecord>;
  readonly journals: MockJournalRecord[];
}
