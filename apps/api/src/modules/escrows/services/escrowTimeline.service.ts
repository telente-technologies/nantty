import type { OrderRecord } from "../../orders/models/orders.model.js";
import type { DisputeRecord, EscrowRecord, EscrowTimelineEvent } from "../models/escrows.model.js";

export function buildEscrowTimeline(escrow: EscrowRecord, order: OrderRecord, disputes: readonly DisputeRecord[]): readonly EscrowTimelineEvent[] {
  const events: EscrowTimelineEvent[] = [{ type: "held", at: escrow.heldAt, details: { orderNumber: order.number } }];
  if (order.shippedAt !== null) events.push({ type: "shipped", at: order.shippedAt, details: { courier: order.courier, trackingNumber: order.trackingNumber } });
  if (order.deliveredAt !== null) events.push({ type: "delivered", at: order.deliveredAt, details: {} });
  for (const dispute of disputes) {
    events.push({ type: "dispute_opened", at: dispute.createdAt, details: { disputeId: dispute.id, reason: dispute.reason } });
    if (dispute.resolvedAt !== null) {
      events.push({ type: "dispute_resolved", at: dispute.resolvedAt, details: { disputeId: dispute.id, status: dispute.status, resolution: dispute.resolution } });
    }
  }
  if (escrow.releasedAt !== null) events.push({ type: "released", at: escrow.releasedAt, details: {} });
  if (escrow.refundedAt !== null) events.push({ type: "refunded", at: escrow.refundedAt, details: {} });
  return events.sort((left, right) => left.at.getTime() - right.at.getTime());
}
