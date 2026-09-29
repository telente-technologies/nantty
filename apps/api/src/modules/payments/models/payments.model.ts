import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { PaymentProvider, PaymentStatus } from "../../../enums/paymentStatus.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export interface PaymentRecord {
  readonly id: string;
  readonly checkoutId: string;
  readonly buyerId: string;
  readonly provider: PaymentProvider;
  readonly reference: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly status: PaymentStatus;
  readonly authorizationUrl: string | null;
  readonly providerTransactionId: string | null;
  readonly paidAt: Date | null;
  readonly refundedAmount: MinorUnits;
  readonly createdAt: Date;
}

export type NewPayment = Pick<PaymentRecord, "checkoutId" | "buyerId" | "provider" | "reference" | "amount" | "currency">;
