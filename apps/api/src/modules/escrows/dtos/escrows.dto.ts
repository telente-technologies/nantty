import { Money } from "../../../utils/money.util.js";
import type { DisputeMessageRecord, DisputeRecord, EscrowRecord, EscrowTimelineEvent } from "../models/escrows.model.js";

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
    evidenceMediaIds: dispute.evidenceMediaIds,
    status: dispute.status,
    resolution: dispute.resolution,
    resolvedAt: convertDateToText(dispute.resolvedAt),
    createdAt: dispute.createdAt.toISOString(),
  };
}

export function convertDisputeMessageToDto(message: DisputeMessageRecord) {
  return {
    id: message.id,
    disputeId: message.disputeId,
    authorId: message.authorId,
    authorRole: message.authorRole,
    text: message.text,
    attachmentMediaIds: message.attachmentMediaIds,
    createdAt: message.createdAt.toISOString(),
  };
}

export function convertEscrowTimelineToDto(escrow: EscrowRecord, timeline: readonly EscrowTimelineEvent[]) {
  return {
    ...convertEscrowToDto(escrow),
    autoReleaseAt: escrow.status === "held" ? convertDateToText(escrow.releaseAfter) : null,
    timeline: timeline.map((event) => ({ type: event.type, at: event.at.toISOString(), details: event.details })),
  };
}
