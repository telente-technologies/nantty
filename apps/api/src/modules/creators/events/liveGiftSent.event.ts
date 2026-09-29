import { defineEvent } from "@zudojs/events";

export interface LiveGiftSentPayload {
  readonly liveSessionId: string;
  readonly giftId: string;
  readonly quantity: number;
  readonly senderId: string;
  readonly creatorId: string;
  readonly amountMinor: number;
  readonly currency: string;
}

export const LiveGiftSentEvent = defineEvent<"creators.liveGiftSent", LiveGiftSentPayload>("creators.liveGiftSent");
