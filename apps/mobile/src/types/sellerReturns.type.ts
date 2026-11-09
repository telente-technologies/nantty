import type { ID, ISODate } from "./models.type";
import type { Money } from "./money.type";

export type SellerReturnStatus = "requested" | "approved" | "declined" | "refunded";

export interface SellerReturnLine {
  readonly orderLineId: ID;
  readonly name: string;
  readonly quantity: number;
}

export interface SellerReturnRequest {
  readonly id: ID;
  readonly orderId: ID;
  readonly orderNumber: string;
  readonly buyerName: string;
  readonly lines: readonly SellerReturnLine[];
  readonly reason: string;
  readonly status: SellerReturnStatus;
  readonly declineNote: string | null;
  readonly refundAmount: Money;
  readonly createdAt: ISODate;
}

export interface DeclineSellerReturnInput {
  readonly note: string;
}

export interface ReceiveSellerReturnInput {
  readonly restock: boolean;
  readonly locationId: ID | null;
}
