import type { Money, PagedList, PartySummary } from "@/types/api.type";

export type OrderStatus = "pending" | "new" | "processing" | "ready" | "shipped" | "delivered" | "completed" | "cancelled" | "returned" | "refunded" | "disputed";
export type RefundSource = "manual" | "seller" | "return" | "cancellation" | "dispute" | "system";
export type RefundStatus = "processing" | "scheduled" | "completed" | "failed";

export interface OrderParty {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface OrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly invoiceNumber: string;
  readonly buyer: OrderParty;
  readonly seller: OrderParty;
  readonly storeId: string;
  readonly storeName: string;
  readonly status: OrderStatus;
  readonly paymentStatus: string;
  readonly paymentMode: string;
  readonly escrowStatus: string;
  readonly deliveryStatus: string;
  readonly total: Money;
  readonly itemCount: number;
  readonly placedAt: string;
}

export interface OrderLineItem {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly variant: string;
  readonly imageUrl: string | null;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly lineTotal: Money;
  readonly attribution: { readonly source: string; readonly id: string } | null;
}

export interface OrderEscrow {
  readonly status: string;
  readonly heldAmount: Money;
  readonly commission: Money;
  readonly sellerAmount: Money;
  readonly refunded: Money;
  readonly autoReleaseAt: string | null;
  readonly releasedAt: string | null;
  readonly refundedAt: string | null;
}

export interface OrderTimelineEvent {
  readonly id: string;
  readonly kind: string;
  readonly summary: string;
  readonly actorKind: string;
  readonly actorName: string;
  readonly occurredAt: string;
}

export interface RefundRecord {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly storeId: string;
  readonly buyer: OrderParty;
  readonly amount: Money;
  readonly source: RefundSource;
  readonly status: RefundStatus;
  readonly reason: string;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly createdByName: string;
}

export interface OrderDetail extends OrderSummary {
  readonly items: readonly OrderLineItem[];
  readonly subtotal: Money;
  readonly discount: Money;
  readonly storeCredit: Money;
  readonly deliveryFee: Money;
  readonly refundedTotal: Money;
  readonly refundable: Money;
  readonly deliveryCity: string;
  readonly deliveryState: string;
  readonly courier: string | null;
  readonly trackingNumber: string | null;
  readonly escrow: OrderEscrow | null;
  readonly refunds: readonly RefundRecord[];
  readonly timeline: readonly OrderTimelineEvent[];
}

export type DisputeStatus = "awaiting_seller" | "under_review" | "resolved_refunded" | "resolved_released" | "closed";
export type DisputeStatusFilter = "all" | "open" | "resolved" | DisputeStatus;
export type DisputeOutcome = "REFUND_FULL" | "REFUND_PARTIAL" | "RELEASE_TO_SELLER";
export type DisputeResolutionOutcome = "release" | "refund" | "partial" | "withdrawn";

export interface DisputeSummary {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly productName: string;
  readonly buyer: PartySummary;
  readonly seller: PartySummary;
  readonly store: { readonly id: string; readonly name: string | null };
  readonly reason: string;
  readonly status: DisputeStatus;
  readonly priority: "normal" | "high" | "urgent";
  readonly escrowAmount: Money;
  readonly openedAt: string;
  readonly slaDueAt: string | null;
  readonly isSlaBreached: boolean;
  readonly ageHours?: number;
}

export interface DisputeEscrow {
  readonly escrowId: string;
  readonly status: string;
  readonly amount: Money;
  readonly heldAmount: Money;
  readonly refundedAmount: Money;
  readonly releasedAmount: Money;
  readonly commission: Money;
  readonly processingFee: Money;
  readonly paymentReference: string;
  readonly deliveredAt: string | null;
}

export interface DisputeResolution {
  readonly outcome: DisputeResolutionOutcome;
  readonly buyerRefund: Money;
  readonly sellerPayout: Money;
  readonly commission: Money;
  readonly note: string;
  readonly resolvedAt: string | null;
  readonly resolvedByStaffId: string | null;
}

export interface DisputeMessage {
  readonly id: string;
  readonly authorRole: "buyer" | "seller" | "support";
  readonly authorName: string;
  readonly authorAvatarUrl: string | null;
  readonly text: string;
  readonly attachmentUrls: readonly string[];
  readonly createdAt: string;
}

export interface DisputeStatusEvent {
  readonly status: string;
  readonly label: string;
  readonly occurredAt: string;
}

export interface DisputeDetail extends DisputeSummary {
  readonly description: string;
  readonly evidenceUrls: readonly string[];
  readonly sellerResponse: string | null;
  readonly commissionBasisPoints: number;
  readonly escrow: DisputeEscrow;
  readonly resolution: DisputeResolution | null;
  readonly messages: readonly DisputeMessage[];
  readonly history: readonly DisputeStatusEvent[];
}

export interface DisputeList extends PagedList<DisputeSummary> {
  readonly counts: Readonly<Partial<Record<DisputeStatus, number>>>;
}

export interface UndeliveredReviewRow {
  readonly escrowId: string;
  readonly orderId: string;
  readonly orderReference: string;
  readonly buyerUserId: string;
  readonly sellerUserId: string;
  readonly storeId: string;
  readonly heldAmount: Money;
  readonly heldSince: string;
  readonly reviewSince: string;
  readonly shippedAt: string | null;
  readonly courierName: string;
  readonly trackingNumber: string;
}

export interface StaffEscrowDecisionResult {
  readonly escrowId: string;
  readonly orderId: string;
  readonly status: string;
  readonly heldAmount: Money;
}
