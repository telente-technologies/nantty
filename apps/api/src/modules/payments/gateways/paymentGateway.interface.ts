import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export interface InitializePaymentRequest {
  readonly reference: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly email: string;
  readonly callbackUrl: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface InitializedPayment {
  readonly authorizationUrl: string;
}

export interface VerifiedPayment {
  readonly status: "succeeded" | "failed" | "pending";
  readonly amount: MinorUnits;
  readonly currency: string;
  readonly providerTransactionId: string | null;
}

export interface RefundPaymentRequest {
  readonly reference: string;
  readonly providerTransactionId: string | null;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
}

export interface BankTransferRequest {
  readonly reference: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly bankCode: string;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly recipientCode: string | null;
  readonly reason: string;
}

export interface BankTransferResult {
  readonly status: "succeeded" | "pending" | "failed";
  readonly recipientCode: string | null;
  readonly failureReason: string | null;
}

export interface WebhookNotice {
  readonly eventKey: string;
  readonly reference: string | null;
}

export type HeaderReader = (name: string) => string | undefined;

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  initializePayment(request: InitializePaymentRequest): Promise<InitializedPayment>;
  verifyPayment(reference: string): Promise<VerifiedPayment>;
  refundPayment(request: RefundPaymentRequest): Promise<void>;
  verifyWebhookSignature(rawBody: Uint8Array, readHeader: HeaderReader): boolean;
  readWebhookNotice(rawBody: Uint8Array): WebhookNotice;
  transferToBank(request: BankTransferRequest): Promise<BankTransferResult>;
}
