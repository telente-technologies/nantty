import { createHmac } from "node:crypto";

import { timingSafeEqualString } from "@zudojs/crypto";

import { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
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

const PAYSTACK_API = "https://api.paystack.co";

export function computePaystackSignature(rawBody: Uint8Array, secretKey: string): string {
  return createHmac("sha512", secretKey).update(rawBody).digest("hex");
}

export class PaystackGateway implements PaymentGateway {
  public readonly provider = PaymentProvider.PAYSTACK;

  public constructor(private readonly secretKey: string) {}

  public async initializePayment(request: InitializePaymentRequest): Promise<InitializedPayment> {
    const response = await sendProviderRequest(`${PAYSTACK_API}/transaction/initialize`, this.secretKey, "POST", {
      email: request.email,
      amount: request.amount,
      currency: request.currency,
      reference: request.reference,
      callback_url: request.callbackUrl,
      metadata: request.metadata,
    });
    const authorizationUrl = readTextField(response.data, "authorization_url");
    if (authorizationUrl === null) throw providerUnavailable();
    return { authorizationUrl };
  }

  public async verifyPayment(reference: string): Promise<VerifiedPayment> {
    const response = await sendProviderRequest(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, this.secretKey, "GET");
    const status = readTextField(response.data, "status");
    return {
      status: status === "success" ? "succeeded" : status === "failed" || status === "abandoned" || status === "reversed" ? "failed" : "pending",
      amount: Number(readTextField(response.data, "amount") ?? 0),
      currency: (readTextField(response.data, "currency") ?? "").toUpperCase(),
      providerTransactionId: readTextField(response.data, "id"),
    };
  }

  public async refundPayment(request: RefundPaymentRequest): Promise<void> {
    await sendProviderRequest(`${PAYSTACK_API}/refund`, this.secretKey, "POST", { transaction: request.reference, amount: request.amount });
  }

  public verifyWebhookSignature(rawBody: Uint8Array, readHeader: HeaderReader): boolean {
    const signature = readHeader("x-paystack-signature") ?? "";
    if (this.secretKey === "" || signature === "") return false;
    return timingSafeEqualString(computePaystackSignature(rawBody, this.secretKey), signature);
  }

  public readWebhookNotice(rawBody: Uint8Array): WebhookNotice {
    const body = parseWebhookJson(rawBody);
    const data = (body["data"] ?? {}) as Record<string, unknown>;
    const reference = readTextField(data, "reference");
    return { eventKey: `${readTextField(body, "event") ?? "event"}:${readTextField(data, "id") ?? reference ?? "unknown"}`, reference };
  }

  public async transferToBank(request: BankTransferRequest): Promise<BankTransferResult> {
    const recipientCode = request.recipientCode ?? (await this.createTransferRecipient(request));
    const response = await sendProviderRequest(`${PAYSTACK_API}/transfer`, this.secretKey, "POST", {
      source: "balance",
      amount: request.amount,
      recipient: recipientCode,
      reference: request.reference,
      reason: request.reason,
      currency: request.currency,
    });
    const status = readTextField(response.data, "status");
    if (status === "success") return { status: "succeeded", recipientCode, failureReason: null };
    if (status === "failed" || status === "reversed") return { status: "failed", recipientCode, failureReason: typeof response.message === "string" ? response.message : null };
    return { status: "pending", recipientCode, failureReason: null };
  }

  private async createTransferRecipient(request: BankTransferRequest): Promise<string> {
    const response = await sendProviderRequest(`${PAYSTACK_API}/transferrecipient`, this.secretKey, "POST", {
      type: "nuban",
      name: request.accountName,
      account_number: request.accountNumber,
      bank_code: request.bankCode,
      currency: request.currency,
    });
    const recipientCode = readTextField(response.data, "recipient_code");
    if (recipientCode === null) throw providerUnavailable();
    return recipientCode;
  }
}
