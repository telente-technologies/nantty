import type { OrderStatus } from "../../../enums/orderStatus.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export interface ShippingAddressSnapshot {
  readonly fullName: string;
  readonly phoneEncrypted: string;
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
}

export interface OrderItemRecord {
  readonly id: string;
  readonly orderId: string;
  readonly productId: string;
  readonly variantId: string;
  readonly title: string;
  readonly size: string | null;
  readonly color: string | null;
  readonly imageUrl: string | null;
  readonly unitPrice: MinorUnits;
  readonly quantity: number;
  readonly lineTotal: MinorUnits;
}

export interface OrderRecord {
  readonly id: string;
  readonly number: string;
  readonly checkoutId: string;
  readonly buyerId: string;
  readonly storeId: string;
  readonly status: OrderStatus;
  readonly currency: string;
  readonly itemsTotal: MinorUnits;
  readonly discountTotal: MinorUnits;
  readonly shippingTotal: MinorUnits;
  readonly total: MinorUnits;
  readonly shippingAddress: ShippingAddressSnapshot;
  readonly trackingNumber: string | null;
  readonly paidAt: Date | null;
  readonly shippedAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly items: readonly OrderItemRecord[];
}

export type CheckoutStatus = "pending" | "paid" | "cancelled";

export interface CheckoutRecord {
  readonly id: string;
  readonly buyerId: string;
  readonly total: MinorUnits;
  readonly currency: string;
  readonly status: CheckoutStatus;
  readonly createdAt: Date;
}

export type NewOrderItem = Omit<OrderItemRecord, "id" | "orderId">;

export interface NewOrder extends Omit<OrderRecord, "id" | "checkoutId" | "items" | "createdAt" | "trackingNumber" | "paidAt" | "shippedAt" | "deliveredAt" | "completedAt" | "cancelledAt"> {
  readonly items: readonly NewOrderItem[];
}

export interface OrderStatusChange {
  readonly trackingNumber?: string | null;
  readonly paidAt?: Date;
  readonly shippedAt?: Date;
  readonly deliveredAt?: Date;
  readonly completedAt?: Date;
  readonly cancelledAt?: Date;
}

export type BuyerOrderFilter = "all" | "pending" | "shipped" | "delivered";

export const BUYER_FILTER_STATUSES: Readonly<Record<BuyerOrderFilter, readonly OrderStatus[] | undefined>> = {
  all: undefined,
  pending: ["pending_payment", "paid"],
  shipped: ["shipped"],
  delivered: ["delivered", "completed"],
};

export const SALE_STATUSES: readonly OrderStatus[] = ["paid", "shipped", "delivered", "completed", "disputed"];
