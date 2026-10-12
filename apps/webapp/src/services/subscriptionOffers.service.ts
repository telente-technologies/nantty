import { createIdempotencyKey, sendRequestToWebappServer } from "@/services/clientApi.service";
import type { OfferCheckout, OfferClaim, OfferInterval, OfferPreview } from "@/types/subscriptionOffer.type";

export const subscriptionOffersService = {
  fetchOffer: (token: string) => sendRequestToWebappServer<OfferPreview>(`/api/v1/subscription-offers/${encodeURIComponent(token)}`),
  claimOffer: (token: string, profileId: string) =>
    sendRequestToWebappServer<OfferClaim>(`/api/v1/subscription-offers/${encodeURIComponent(token)}/claim`, { method: "POST", body: { profileId } }),
  startOfferCheckout: (input: { readonly profileId: string; readonly planCode: string; readonly interval: OfferInterval; readonly offerClaimId: string; readonly returnTo: string }) =>
    sendRequestToWebappServer<OfferCheckout>("/api/v1/subscriptions/checkout", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("offer") }),
};
