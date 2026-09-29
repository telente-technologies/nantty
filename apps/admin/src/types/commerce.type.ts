import type { AuditLogEntry } from "@/types/audit.type";
import type { Money, PagedList } from "@/types/api.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type OrderStatus = "PAID" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "DISPUTED";
export type EscrowStatus = "FUNDED" | "HELD" | "RELEASED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "DISPUTED";
export type DeliveryStatus = "AWAITING_SHIPMENT" | "IN_TRANSIT" | "DELIVERED" | "RETURNED" | "CANCELLED";
export type EscrowEventKind = "FUNDED" | "HELD" | "SHIPPED" | "DELIVERED" | "AUTO_RELEASE_SCHEDULED" | "DISPUTED" | "RELEASED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export interface EscrowTimelineEvent {
  readonly id: string;
  readonly kind: EscrowEventKind;
  readonly occurredAt: string;
  readonly actorName: string;
  readonly actorKind: "BUYER" | "SELLER" | "ADMIN" | "SYSTEM";
  readonly note: string | null;
  readonly amount: Money | null;
}

export interface OrderLineItem {
  readonly id: string;
  readonly productName: string;
  readonly imageUrl: string | null;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly lineTotal: Money;
}

export interface OrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly buyer: PlatformUserSummary;
  readonly seller: PlatformUserSummary;
  readonly storeName: string;
  readonly status: OrderStatus;
  readonly escrowStatus: EscrowStatus;
  readonly deliveryStatus: DeliveryStatus;
  readonly total: Money;
  readonly itemCount: number;
  readonly placedAt: string;
  readonly disputeId: string | null;
}

export interface EscrowState {
  readonly status: EscrowStatus;
  readonly heldAmount: Money;
  readonly autoReleaseAt: string | null;
  readonly timeline: readonly EscrowTimelineEvent[];
}

export interface RefundRecord {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly buyer: PlatformUserSummary;
  readonly amount: Money;
  readonly source: "DISPUTE" | "MANUAL";
  readonly status: "PROCESSING" | "COMPLETED" | "FAILED";
  readonly reason: string;
  readonly createdAt: string;
  readonly createdByName: string;
}

export interface OrderDetail extends OrderSummary {
  readonly items: readonly OrderLineItem[];
  readonly subtotal: Money;
  readonly deliveryFee: Money;
  readonly commission: Money;
  readonly commissionBasisPoints: number;
  readonly refundedTotal: Money;
  readonly refundable: Money;
  readonly deliveryCity: string;
  readonly courier: string | null;
  readonly trackingNumber: string | null;
  readonly escrow: EscrowState;
  readonly refunds: readonly RefundRecord[];
  readonly history: readonly AuditLogEntry[];
}

export type DisputeStatus = "OPEN" | "AWAITING_SELLER" | "IN_REVIEW" | "RESOLVED";
export type DisputeOutcome = "REFUND_FULL" | "REFUND_PARTIAL" | "RELEASE_TO_SELLER";

export interface DisputeSummary {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly buyer: PlatformUserSummary;
  readonly seller: PlatformUserSummary;
  readonly reasonCategory: string;
  readonly status: DisputeStatus;
  readonly priority: "NORMAL" | "HIGH" | "URGENT";
  readonly escrowAmount: Money;
  readonly openedAt: string;
  readonly slaDueAt: string;
}

export interface DisputeMessage {
  readonly id: string;
  readonly authorName: string;
  readonly authorRole: "BUYER" | "SELLER" | "ADMIN";
  readonly body: string;
  readonly sentAt: string;
}

export interface DisputeEvidence {
  readonly id: string;
  readonly imageUrl: string;
  readonly caption: string;
  readonly submittedBy: "BUYER" | "SELLER";
}

export interface DisputeResolution {
  readonly outcome: DisputeOutcome;
  readonly buyerRefund: Money;
  readonly sellerPayout: Money;
  readonly commission: Money;
  readonly reason: string;
  readonly resolvedAt: string;
  readonly resolvedByName: string;
}

export interface DisputeDetail extends DisputeSummary {
  readonly buyerClaim: string;
  readonly sellerResponse: string | null;
  readonly evidence: readonly DisputeEvidence[];
  readonly messages: readonly DisputeMessage[];
  readonly commissionBasisPoints: number;
  readonly resolution: DisputeResolution | null;
  readonly escrow: EscrowState;
  readonly history: readonly AuditLogEntry[];
}

export interface DisputeList extends PagedList<DisputeSummary> {
  readonly counts: Readonly<Record<DisputeStatus, number>>;
}
