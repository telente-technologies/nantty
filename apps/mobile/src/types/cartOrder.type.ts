import type { ID, ISODate, ProductSummary, StoreSummary, UserSummary } from "./models.type";
import type { Money } from "./money.type";
import type { CartSellerGroup } from "./shipping.type";

export interface CartItem {
  readonly id: ID;
  readonly product: ProductSummary;
  readonly quantity: number;
  readonly variant: string | null;
}

export interface Cart {
  readonly items: readonly CartItem[];
  readonly itemsTotal: Money;
  readonly shopDiscount: Money;
  readonly storeCredit: Money;
  readonly shipping: Money;
  readonly total: Money;
  readonly groups: readonly CartSellerGroup[];
  readonly addressId: string | null;
  readonly payableGroupCount: number;
}

export type PaymentMode = "escrow" | "direct";

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "completed" | "cancelled" | "disputed";

export type DeliveryStatus = "pending" | "preparing" | "ready_for_pickup" | "in_transit" | "delivered" | "failed" | "cancelled" | "returned";

export interface DeliveryDetails {
  readonly status: DeliveryStatus;
  readonly riderName: string | null;
  readonly riderPhone: string | null;
  readonly estimatedDeliveryAt: ISODate | null;
  readonly attempts: number;
  readonly lastAttemptNote: string | null;
}

export interface OrderShipment {
  readonly courierName: string;
  readonly trackingNumber: string;
  readonly trackingUrl: string | null;
  readonly shippedAt: ISODate;
  readonly estimatedDeliveryAt: ISODate | null;
}

export interface Order {
  readonly id: ID;
  readonly reference: string;
  readonly status: OrderStatus;
  readonly items: readonly CartItem[];
  readonly total: Money;
  readonly buyer: UserSummary;
  readonly store: StoreSummary;
  readonly createdAt: ISODate;
  readonly escrowReleaseAt: ISODate | null;
  readonly paymentMode?: PaymentMode;
  readonly shipment?: OrderShipment | null;
  readonly delivery?: DeliveryDetails | null;
  readonly promotionIssue?: PromotionIssue | null;
}

export interface PromotionIssue {
  readonly code: string;
  readonly message: string;
}

export interface Address {
  readonly id: ID;
  readonly fullName: string;
  readonly phone: string;
  readonly line1: string;
  readonly city: string;
  readonly state: string;
  readonly isDefault: boolean;
  readonly countryId: string;
  readonly countryCode: string;
  readonly country: string;
  readonly stateId: string | null;
  readonly lgaId: string | null;
  readonly lga: string | null;
  readonly cityId: string | null;
  readonly postalCode: string;
  readonly details: string;
}
