import { defineEvent } from "@zudojs/events";

export interface PaymentLifecyclePayload {
  readonly paymentId: string;
  readonly checkoutId: string;
  readonly buyerId: string;
  readonly amount: number;
}

export const PaymentSucceededEvent = defineEvent<"payments.paymentSucceeded", PaymentLifecyclePayload>("payments.paymentSucceeded");
export const PaymentFailedEvent = defineEvent<"payments.paymentFailed", PaymentLifecyclePayload>("payments.paymentFailed");
