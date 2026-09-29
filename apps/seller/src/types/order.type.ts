import type { Money } from "@/types/money.type";

export type OnlineOrderStatus = "paid" | "processing" | "shipped" | "delivered" | "completed" | "cancelled" | "refunded" | "disputed";
export type EscrowStatus = "held" | "released" | "refunded" | "disputed";

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
  readonly buyer: { readonly id: string; readonly name: string; readonly username: string };
  readonly shippingAddress: ShippingAddress;
  readonly lines: OnlineOrderLine[];
  readonly subtotal: Money;
  readonly shippingFee: Money;
  readonly total: Money;
  readonly sellerPayout: Money;
  readonly status: OnlineOrderStatus;
  readonly escrowStatus: EscrowStatus;
  readonly escrowReleaseAt: string | null;
  readonly fulfilment: OrderFulfilment | null;
  readonly attributedCreator: { readonly id: string; readonly username: string } | null;
  readonly createdAt: string;
  readonly deliveredAt: string | null;
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
