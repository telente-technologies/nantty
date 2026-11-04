export type LogisticsShipmentStatus = "pending" | "quoted" | "booked" | "picked_up" | "in_transit" | "delivered" | "cancelled" | "failed";

export interface LogisticsException {
  readonly reason: string;
  readonly status: string;
}

export interface LogisticsShipmentSummary {
  readonly shipmentId: string;
  readonly orderId: string;
  readonly storeId: string;
  readonly reference: string;
  readonly provider: string;
  readonly status: LogisticsShipmentStatus;
  readonly trackingNumber: string | null;
  readonly trackingUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly exception: LogisticsException | null;
}

export interface LogisticsShipmentPage {
  readonly items: readonly LogisticsShipmentSummary[];
  readonly nextCursor: string | null;
}
