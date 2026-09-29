import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { OrderStatus } from "../../../enums/orderStatus.enum.js";
import type { SaleAttributionSource } from "../../../interfaces/orderLookup.interface.js";
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
  readonly attributionSource: SaleAttributionSource | null;
  readonly attributionId: string | null;
}

export interface OrderRecord {
  readonly id: string;
  readonly number: string;
  readonly checkoutId: string;
  readonly buyerId: string;
  readonly storeId: string;
  readonly status: OrderStatus;
  readonly currency: CurrencyCode;
  readonly itemsTotal: MinorUnits;
  readonly discountTotal: MinorUnits;
  readonly shippingTotal: MinorUnits;
  readonly total: MinorUnits;
  readonly chargeCurrency: CurrencyCode;
  readonly chargeTotal: MinorUnits;
  readonly exchangeRate: bigint;
  readonly rateLockedAt: Date;
  readonly shippingAddress: ShippingAddressSnapshot;
  readonly customerName: string;
  readonly trackingNumber: string | null;
  readonly courier: string | null;
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
  readonly currency: CurrencyCode;
  readonly status: CheckoutStatus;
  readonly createdAt: Date;
}

export type NewOrderItem = Omit<OrderItemRecord, "id" | "orderId">;

export interface NewOrder extends Omit<OrderRecord, "id" | "checkoutId" | "items" | "createdAt" | "trackingNumber" | "courier" | "paidAt" | "shippedAt" | "deliveredAt" | "completedAt" | "cancelledAt"> {
  readonly items: readonly NewOrderItem[];
}

export interface OrderStatusChange {
  readonly trackingNumber?: string | null;
  readonly courier?: string | null;
  readonly paidAt?: Date;
  readonly shippedAt?: Date;
  readonly deliveredAt?: Date;
  readonly completedAt?: Date;
  readonly cancelledAt?: Date;
}

export const PUBLIC_ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "completed", "cancelled", "disputed"] as const;
export type PublicOrderStatus = (typeof PUBLIC_ORDER_STATUSES)[number];

export const INTERNAL_STATUSES_FOR_PUBLIC_STATUS: Readonly<Record<PublicOrderStatus, readonly OrderStatus[]>> = {
  pending: ["pending_payment"],
  paid: ["paid"],
  shipped: ["shipped"],
  delivered: ["delivered"],
  completed: ["completed"],
  cancelled: ["cancelled", "refunded"],
  disputed: ["disputed"],
};

export function convertInternalStatusToPublicStatus(status: OrderStatus): PublicOrderStatus {
  if (status === "pending_payment") return "pending";
  if (status === "refunded") return "cancelled";
  return status;
}

export const SALE_STATUSES: readonly OrderStatus[] = ["paid", "shipped", "delivered", "completed", "disputed"];
