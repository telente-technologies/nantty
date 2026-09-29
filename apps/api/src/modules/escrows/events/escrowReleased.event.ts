import { defineEvent } from "@zudojs/events";

export interface EscrowLifecyclePayload {
  readonly escrowId: string;
  readonly orderId: string;
  readonly storeId: string;
  readonly amount: number;
}

export const EscrowHeldEvent = defineEvent<"escrows.escrowHeld", EscrowLifecyclePayload>("escrows.escrowHeld");
export const EscrowReleasedEvent = defineEvent<"escrows.escrowReleased", EscrowLifecyclePayload>("escrows.escrowReleased");
export const EscrowRefundedEvent = defineEvent<"escrows.escrowRefunded", EscrowLifecyclePayload>("escrows.escrowRefunded");
export const EscrowDisputedEvent = defineEvent<"escrows.escrowDisputed", EscrowLifecyclePayload>("escrows.escrowDisputed");
