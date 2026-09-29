import { timingSafeEqualString } from "@zudojs/crypto";

import { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import { CURRENCY_MINOR_UNIT_DIGITS } from "../../../configs/currency.config.js";
import { isSupportedCurrencyCode, type CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type {
  BankTransferRequest,
  BankTransferResult,
  HeaderReader,
  InitializedPayment,
  InitializePaymentRequest,
  PaymentGateway,
  RefundPaymentRequest,
  VerifiedPayment,
  WebhookNotice,
} from "./paymentGateway.interface.js";
import { parseWebhookJson, providerUnavailable, readTextField, sendProviderRequest } from "./providerRequest.gateway.js";

const FLUTTERWAVE_API = "https://api.flutterwave.com/v3";

export function convertMinorUnitsToMajorUnits(amount: MinorUnits, currency: CurrencyCode): number {
  return amount / 10 ** CURRENCY_MINOR_UNIT_DIGITS[currency];
}

export function convertMajorUnitsToMinorUnits(amount: number, currency: CurrencyCode): MinorUnits {
  return Math.round(amount * 10 ** CURRENCY_MINOR_UNIT_DIGITS[currency]);
}

export class FlutterwaveGateway implements PaymentGateway {
  public readonly provider = PaymentProvider.FLUTTERWAVE;

  public constructor(private readonly secretKey: string, private readonly webhookHash: string) {}

  public async initializePayment(request: InitializePaymentRequest): Promise<InitializedPayment> {
    const response = await sendProviderRequest(`${FLUTTERWAVE_API}/payments`, this.secretKey, "POST", {
      tx_ref: request.reference,
      amount: convertMinorUnitsToMajorUnits(request.amount, request.currency),
      currency: request.currency,
      redirect_url: request.callbackUrl,
      customer: { email: request.email },
      meta: request.metadata,
    });
    const authorizationUrl = readTextField(response.data, "link");
    if (authorizationUrl === null) throw providerUnavailable();
    return { authorizationUrl };
  }

  public async verifyPayment(reference: string): Promise<VerifiedPayment> {
    const url = `${FLUTTERWAVE_API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
    const response = await sendProviderRequest(url, this.secretKey, "GET");
    const status = readTextField(response.data, "status");
    const currency = (readTextField(response.data, "currency") ?? "").toUpperCase();
    return {
      status: status === "successful" ? "succeeded" : status === "failed" || status === "cancelled" ? "failed" : "pending",
      amount: isSupportedCurrencyCode(currency) ? convertMajorUnitsToMinorUnits(Number(readTextField(response.data, "amount") ?? 0), currency) : -1,
      currency,
      providerTransactionId: readTextField(response.data, "id"),
    };
  }

  public async refundPayment(request: RefundPaymentRequest): Promise<void> {
    if (request.providerTransactionId === null) throw providerUnavailable();
    await sendProviderRequest(`${FLUTTERWAVE_API}/transactions/${encodeURIComponent(request.providerTransactionId)}/refund`, this.secretKey, "POST", {
      amount: convertMinorUnitsToMajorUnits(request.amount, request.currency),
    });
  }

  public verifyWebhookSignature(_rawBody: Uint8Array, readHeader: HeaderReader): boolean {
    const presented = readHeader("verif-hash") ?? "";
    if (this.webhookHash === "" || presented === "") return false;
    return timingSafeEqualString(presented, this.webhookHash);
  }

  public readWebhookNotice(rawBody: Uint8Array): WebhookNotice {
    const body = parseWebhookJson(rawBody);
    const data = (body["data"] ?? {}) as Record<string, unknown>;
    const reference = readTextField(data, "tx_ref");
    return { eventKey: `${readTextField(body, "event") ?? "event"}:${readTextField(data, "id") ?? reference ?? "unknown"}`, reference };
  }

  public async transferToBank(request: BankTransferRequest): Promise<BankTransferResult> {
    const response = await sendProviderRequest(`${FLUTTERWAVE_API}/transfers`, this.secretKey, "POST", {
      account_bank: request.bankCode,
      account_number: request.accountNumber,
      amount: convertMinorUnitsToMajorUnits(request.amount, request.currency),
      currency: request.currency,
      reference: request.reference,
      narration: request.reason,
    });
    const status = readTextField(response.data, "status");
    if (status === "FAILED") return { status: "failed", recipientCode: null, failureReason: readTextField(response.data, "complete_message") };
    if (status === "SUCCESSFUL") return { status: "succeeded", recipientCode: null, failureReason: null };
    return { status: "pending", recipientCode: null, failureReason: null };
  }
}
