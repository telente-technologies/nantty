import type { DeliveryStatus, DisputeEvidence, DisputeMessage, DisputeOutcome, DisputeStatus, EscrowStatus, EscrowTimelineEvent, OrderStatus } from "@/types/commerce.type";
import type { CoinTransactionKind, CoinTransactionStatus, FraudAssessment, PayoutDestination, PayoutStatus } from "@/types/payouts.type";
import type { LedgerAccountKind } from "@/types/ledger.type";
import type { RiskLevel } from "@/types/platformUser.type";

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
  status: OrderStatus;
  deliveryStatus: DeliveryStatus;
  escrowStatus: EscrowStatus;
  autoReleaseAt: string | null;
  timeline: EscrowTimelineEvent[];
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
  readonly evidence: readonly DisputeEvidence[];
  readonly messages: DisputeMessage[];
  status: DisputeStatus;
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

export interface MockPayoutRecord {
  readonly id: string;
  readonly userId: string;
  readonly amountMinor: number;
  readonly providerFeeMinor: number;
  readonly currency: string;
  readonly provider: string;
  readonly destination: PayoutDestination;
  readonly source: "CREATOR_EARNINGS" | "SELLER_SALES" | "WALLET";
  readonly requestedAt: string;
  readonly fraud: FraudAssessment;
  readonly walletBalanceAfterMinor: number;
  status: PayoutStatus;
}

export interface MockCoinRecord {
  readonly id: string;
  readonly kind: CoinTransactionKind;
  readonly senderId: string;
  readonly receiverId: string | null;
  readonly coins: number;
  readonly fiatMinor: number;
  readonly currency: string;
  readonly feeBasisPoints: number | null;
  readonly context: string;
  readonly paymentProvider: string | null;
  readonly flags: readonly string[];
  readonly chargebackRisk: RiskLevel;
  readonly createdAt: string;
  status: CoinTransactionStatus;
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
  readonly payouts: MockPayoutRecord[];
  readonly coinTransactions: MockCoinRecord[];
  readonly ledgerAccounts: Map<string, MockLedgerAccountRecord>;
  readonly journals: MockJournalRecord[];
}
