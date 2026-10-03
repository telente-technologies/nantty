import type { DeliveryStatus } from "@/types/delivery.type";
import type { Money } from "@/types/money.type";

export type OnlineOrderStatus = "new" | "processing" | "ready" | "shipped" | "delivered" | "completed" | "cancelled" | "returned" | "refunded" | "disputed";
export type EscrowStatus = "held" | "released" | "refunded" | "disputed";
export type OrderPaymentStatus = "paid" | "partially_refunded" | "refunded";
export type OrderPaymentProvider = "paystack";
export type OrderTimelineEventKind = "placed" | "paid" | "accepted" | "rejected" | "processing" | "ready" | "shipped" | "delivery_failed" | "delivered" | "completed" | "cancelled" | "returned" | "refunded" | "disputed" | "note";

export interface OrderTimelineEvent {
  readonly id: string;
  readonly kind: OrderTimelineEventKind;
  readonly summary: string;
  readonly actorName: string | null;
  readonly createdAt: string;
}

export interface OrderInternalNote {
  readonly id: string;
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: string;
}

export interface OrderRefund {
  readonly id: string;
  readonly amount: Money;
  readonly reason: string;
  readonly createdAt: string;
}

export interface OrderDeliveryDetails {
  readonly status: DeliveryStatus;
  readonly riderName: string | null;
  readonly riderPhone: string | null;
  readonly estimatedDeliveryAt: string | null;
  readonly attempts: number;
  readonly lastAttemptNote: string | null;
}

export interface OnlineOrderLine {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly name: string;
  readonly variantTitle: string;
  readonly sku: string;
  readonly imageUrl: string | null;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly lineTotal: Money;
}

export interface ShippingAddress {
  readonly recipientName: string;
  readonly phone: string;
  readonly line1: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
}

export interface OrderFulfilment {
  readonly courier: string;
  readonly trackingNumber: string;
  readonly trackingUrl: string | null;
  readonly shippedAt: string;
  readonly fromLocationId: string;
}

export interface OnlineOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly invoiceNumber: string;
  readonly buyer: { readonly id: string; readonly name: string; readonly username: string; readonly phone: string | null };
  readonly shippingAddress: ShippingAddress;
  readonly lines: OnlineOrderLine[];
  readonly subtotal: Money;
  readonly shippingFee: Money;
  readonly total: Money;
  readonly sellerPayout: Money;
  readonly paymentMode: "escrow" | "direct";
  readonly escrowFee: Money;
  readonly escrowFeeBasisPoints: number;
  readonly paymentProcessingFee: Money;
  readonly status: OnlineOrderStatus;
  readonly escrowStatus: EscrowStatus;
  readonly escrowReleaseAt: string | null;
  readonly fulfilment: OrderFulfilment | null;
  readonly attributedCreator: { readonly id: string; readonly username: string } | null;
  readonly createdAt: string;
  readonly deliveredAt: string | null;
  readonly paymentStatus: OrderPaymentStatus;
  readonly paymentProvider: OrderPaymentProvider;
  readonly paymentReference: string;
  readonly paidAt: string;
  readonly refundedAmount: Money;
  readonly refunds: OrderRefund[];
  readonly delivery: OrderDeliveryDetails;
  readonly timeline: OrderTimelineEvent[];
  readonly notes: OrderInternalNote[];
  readonly conversationId: string | null;
}

export type ReturnRequestStatus = "requested" | "approved" | "received" | "refunded" | "declined";

export interface ReturnRequest {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly buyerName: string;
  readonly lines: { readonly orderLineId: string; readonly name: string; readonly quantity: number }[];
  readonly reason: string;
  readonly status: ReturnRequestStatus;
  readonly refundAmount: Money;
  readonly createdAt: string;
}

export type DisputeStatus = "open" | "awaiting_seller" | "under_review" | "resolved_for_buyer" | "resolved_for_seller";

export interface OrderDispute {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly buyerName: string;
  readonly reason: string;
  readonly amount: Money;
  readonly status: DisputeStatus;
  readonly respondBy: string | null;
  readonly messages: { readonly id: string; readonly from: "buyer" | "seller" | "zudomart"; readonly body: string; readonly createdAt: string }[];
  readonly openedAt: string;
}
