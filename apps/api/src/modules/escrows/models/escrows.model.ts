import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { EscrowStatus } from "../../../enums/escrowStatus.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export interface EscrowRecord {
  readonly id: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly storeId: string;
  readonly buyerId: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly status: EscrowStatus;
  readonly releaseAfter: Date | null;
  readonly heldAt: Date;
  readonly releasedAt: Date | null;
  readonly refundedAt: Date | null;
  readonly version: number;
}

export type NewEscrow = Pick<EscrowRecord, "orderId" | "paymentId" | "storeId" | "buyerId" | "amount" | "currency" | "heldAt">;

export interface EscrowStatusChange {
  readonly releasedAt?: Date;
  readonly refundedAt?: Date;
}

export type DisputeStatus = "open" | "resolved_release" | "resolved_refund";

export interface DisputeRecord {
  readonly id: string;
  readonly escrowId: string;
  readonly orderId: string;
  readonly openedById: string;
  readonly reason: string;
  readonly details: string;
  readonly status: DisputeStatus;
  readonly resolution: string | null;
  readonly resolvedById: string | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
}

export type NewDispute = Pick<DisputeRecord, "escrowId" | "orderId" | "openedById" | "reason" | "details" | "createdAt">;

export const ESCROW_TRANSITIONS: Readonly<Record<EscrowStatus, readonly EscrowStatus[]>> = {
  held: ["released", "refunded", "disputed"],
  disputed: ["released", "refunded"],
  released: [],
  refunded: [],
};

export function listStatusesThatCanMoveTo(target: EscrowStatus): readonly EscrowStatus[] {
  return (Object.keys(ESCROW_TRANSITIONS) as EscrowStatus[]).filter((status) => ESCROW_TRANSITIONS[status].includes(target));
}
