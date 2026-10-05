import type { PaymentChannel, PaymentInitialization, PaymentProvider, PaymentVerification, SavedCardCharge } from "@/types/commerce.type";

import * as WebBrowser from "expo-web-browser";

import { shouldUseMockForPath } from "@/config/api.config";

import { api } from "./apiClient.service";

export const PAYMENT_RETURN_URL = "zudomart://payments/return";

interface SavedCardChargeWire {
  readonly status: string;
  readonly authorizationUrl?: string | null;
  readonly checkoutUrl?: string | null;
}

const toSavedCardCharge = (wire: SavedCardChargeWire): SavedCardCharge => {
  if (wire.status === "requires_authentication" || wire.status === "requires_checkout") return { status: "action_required", authorizationUrl: wire.authorizationUrl ?? wire.checkoutUrl ?? undefined };
  if (wire.status === "succeeded" || wire.status === "paid") return { status: "paid" };
  if (wire.status === "failed") return { status: "failed" };
  return { status: "pending" };
};

export const paymentsService = {
  fetchPaymentChannels: () => api.get<{ channels: PaymentChannel[] }>("/api/v1/payments/channels"),
  initializeOrderPayment: (orderId: string, provider: PaymentProvider, idempotencyKey: string) =>
    api.post<PaymentInitialization>("/api/v1/payments/initialize", { orderId, provider }, { idempotencyKey }),
  chargeSavedCard: async (orderId: string, savedCardId: string, idempotencyKey: string): Promise<SavedCardCharge> => {
    const intent = await paymentsService.initializeOrderPayment(orderId, "paystack", idempotencyKey);
    const charge = await api.post<SavedCardChargeWire>("/api/v1/payments/saved-cards/charges", { paymentReference: intent.reference, savedCardId });
    return toSavedCardCharge(charge);
  },
  verifyOrderPayment: (orderId: string) => api.post<PaymentVerification>(`/api/v1/payments/orders/${orderId}/verify`),
  openHostedCheckoutInAppBrowser: async (authorizationUrl: string): Promise<"returned" | "dismissed"> => {
    if (shouldUseMockForPath("/api/v1/payments")) return "returned";
    const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, PAYMENT_RETURN_URL);
    return result.type === "success" ? "returned" : "dismissed";
  },
};
