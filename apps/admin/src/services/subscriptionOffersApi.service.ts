import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { NewOfferLinkInput, OfferLink, OfferLinkList, OfferLinkSend, SendOfferLinkInput } from "@/types/subscriptionOffers.type";

export function fetchOfferLinks(signal?: AbortSignal): Promise<OfferLinkList> {
  return sendAdminApiRequest("/admin/subscriptions/offer-links", { signal });
}

export function createOfferLink(input: NewOfferLinkInput, reason: string): Promise<OfferLink> {
  return sendAdminApiRequest("/admin/subscriptions/offer-links", { method: "POST", body: { ...input, reason } });
}

export function revokeOfferLink(linkId: string, reason: string): Promise<OfferLink> {
  return sendAdminApiRequest(`/admin/subscriptions/offer-links/${encodeURIComponent(linkId)}/revoke`, { method: "POST", body: { reason } });
}

export function sendOfferLink(linkId: string, input: SendOfferLinkInput, reason: string): Promise<{ readonly data: readonly OfferLinkSend[] }> {
  return sendAdminApiRequest(`/admin/subscriptions/offer-links/${encodeURIComponent(linkId)}/sends`, { method: "POST", body: { ...input, reason } });
}
