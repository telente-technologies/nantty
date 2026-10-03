import type { Money } from "@/types/money.type";

export type DeliveryStatus = "pending" | "preparing" | "ready_for_pickup" | "in_transit" | "delivered" | "failed" | "cancelled" | "returned";
export type DeliveryPipelineStatus = Exclude<DeliveryStatus, "cancelled" | "returned">;

export interface DeliveryShipment {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly buyerName: string;
  readonly buyerUsername: string;
  readonly city: string;
  readonly state: string;
  readonly status: DeliveryStatus;
  readonly courier: string | null;
  readonly trackingNumber: string | null;
  readonly riderName: string | null;
  readonly riderPhone: string | null;
  readonly estimatedDeliveryAt: string | null;
  readonly attempts: number;
  readonly lastAttemptNote: string | null;
  readonly deliveryFee: Money;
  readonly itemsCount: number;
  readonly orderedAt: string;
  readonly updatedAt: string;
}

export interface DeliverySummary {
  readonly countsByStatus: Record<DeliveryPipelineStatus, number>;
  readonly feesCollectedLast30Days: Money;
  readonly averageDeliveryDays: number | null;
  readonly failedDeliveryRateBasisPoints: number;
  readonly onTimeRateBasisPoints: number;
}

export interface DeliveryArea {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly cities: string[];
  readonly fee: Money;
  readonly estimatedDaysMin: number;
  readonly estimatedDaysMax: number;
  readonly active: boolean;
}

export interface DeliveryAreaInput {
  readonly name: string;
  readonly state: string;
  readonly cities: string[];
  readonly feeMinor: number;
  readonly estimatedDaysMin: number;
  readonly estimatedDaysMax: number;
  readonly active: boolean;
}
