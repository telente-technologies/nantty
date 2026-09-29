import { Money } from "../../../utils/money.util.js";
import type { DisputeRecord, EscrowRecord } from "../models/escrows.model.js";

function convertDateToText(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export function convertEscrowToDto(escrow: EscrowRecord) {
  return {
    id: escrow.id,
    orderId: escrow.orderId,
    storeId: escrow.storeId,
    amount: Money.of(escrow.amount, escrow.currency).toDto(),
    status: escrow.status,
    releaseAfter: convertDateToText(escrow.releaseAfter),
    heldAt: escrow.heldAt.toISOString(),
    releasedAt: convertDateToText(escrow.releasedAt),
    refundedAt: convertDateToText(escrow.refundedAt),
  };
}

export function convertDisputeToDto(dispute: DisputeRecord) {
  return {
    id: dispute.id,
    escrowId: dispute.escrowId,
    orderId: dispute.orderId,
    openedById: dispute.openedById,
    reason: dispute.reason,
    details: dispute.details,
    status: dispute.status,
    resolution: dispute.resolution,
    resolvedAt: convertDateToText(dispute.resolvedAt),
    createdAt: dispute.createdAt.toISOString(),
  };
}
