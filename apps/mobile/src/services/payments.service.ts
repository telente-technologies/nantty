import type { PaymentChannel, PaymentInitialization, PaymentVerification, SavedCardCharge, SavedCardOffer } from "@/types/commerce.type";

import * as WebBrowser from "expo-web-browser";

import { shouldUseMockForPath } from "@/config/api.config";

import { api } from "./apiClient.service";

export const PAYMENT_RETURN_URL = "zudomart://payments/return";

interface SavedCardChargeWire {
  readonly status: string;
  readonly authorizationUrl?: string | null;
  readonly checkoutUrl?: string | null;
}

interface StartedCardSetupWire {
  readonly reference: string;
  readonly checkoutUrl: string;
}

interface DeviceSavedCardWire {
  readonly savedCardId: string;
  readonly brand: string;
  readonly last4: string;
  readonly expiryMonth: number;
  readonly expiryYear: number;
}

const toSavedCardCharge = (wire: SavedCardChargeWire): SavedCardCharge => {
  if (wire.status === "requires_authentication" || wire.status === "requires_checkout") return { status: "action_required", authorizationUrl: wire.authorizationUrl ?? wire.checkoutUrl ?? undefined };
  if (wire.status === "succeeded" || wire.status === "paid") return { status: "paid" };
  if (wire.status === "failed") return { status: "failed" };
  return { status: "pending" };
};

export const paymentsService = {
  fetchPaymentChannels: () => api.get<{ channels: PaymentChannel[] }>("/api/v1/payments/channels"),
  initializeOrderPayment: (orderId: string, idempotencyKey: string) =>
    api.post<PaymentInitialization>("/api/v1/payments/initialize", { orderId }, { idempotencyKey }),
  chargeSavedCard: async (orderId: string, savedCardId: string, idempotencyKey: string): Promise<SavedCardCharge> => {
    const intent = await paymentsService.initializeOrderPayment(orderId, idempotencyKey);
    const charge = await api.post<SavedCardChargeWire>("/api/v1/payments/saved-cards/charges", { paymentReference: intent.reference, savedCardId }, { idempotencyKey: `${idempotencyKey}-card` });
    return toSavedCardCharge(charge);
  },
  setUpCardOnThisDevice: async (idempotencyKey: string): Promise<SavedCardOffer | null> => {
    const setup = await api.post<StartedCardSetupWire>("/api/v1/payments/saved-cards/setups", {}, { idempotencyKey });
    await paymentsService.openHostedCheckoutInAppBrowser(setup.checkoutUrl).catch(() => "dismissed");
    const card = await api.post<DeviceSavedCardWire>(`/api/v1/payments/saved-cards/setups/${encodeURIComponent(setup.reference)}/complete`).catch(() => null);
    return card ? { savedCardId: card.savedCardId, brand: card.brand, last4: card.last4, expMonth: card.expiryMonth, expYear: card.expiryYear } : null;
  },
  verifyOrderPayment: (orderId: string) => api.post<PaymentVerification>(`/api/v1/payments/orders/${orderId}/verify`),
  hostedCheckoutUrlOf: (payment: { readonly checkoutUrl?: string | null; readonly authorizationUrl?: string | null }) => payment.checkoutUrl || payment.authorizationUrl || undefined,
  openHostedCheckoutInAppBrowser: async (authorizationUrl: string): Promise<"returned" | "dismissed"> => {
    if (shouldUseMockForPath("/api/v1/payments")) return "returned";
    const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, PAYMENT_RETURN_URL);
    return result.type === "success" ? "returned" : "dismissed";
  },
};
