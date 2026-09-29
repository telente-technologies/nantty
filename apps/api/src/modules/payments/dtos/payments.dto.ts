import type { PaymentRecord } from "../models/payments.model.js";

export function convertPaymentToDto(payment: PaymentRecord) {
  return {
    id: payment.id,
    checkoutId: payment.checkoutId,
    provider: payment.provider,
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    authorizationUrl: payment.status === "pending" ? payment.authorizationUrl : null,
    refundedAmount: payment.refundedAmount,
    paidAt: payment.paidAt === null ? null : payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  };
}
