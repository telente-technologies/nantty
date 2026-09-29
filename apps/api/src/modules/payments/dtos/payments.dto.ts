import { Money } from "../../../utils/money.util.js";
import type { PaymentRecord } from "../models/payments.model.js";

export function convertPaymentToDto(payment: PaymentRecord) {
  return {
    id: payment.id,
    checkoutId: payment.checkoutId,
    provider: payment.provider,
    reference: payment.reference,
    amount: Money.of(payment.amount, payment.currency).toDto(),
    status: payment.status,
    authorizationUrl: payment.status === "pending" ? payment.authorizationUrl : null,
    refundedAmount: Money.of(payment.refundedAmount, payment.currency).toDto(),
    paidAt: payment.paidAt === null ? null : payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  };
}
