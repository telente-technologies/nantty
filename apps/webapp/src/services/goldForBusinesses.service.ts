import type { ID } from "@/types";
import type { GoldForBusinessesCheckout, GoldForBusinessesCheckoutInput, GoldForBusinessesProfilesChange, GoldForBusinessesQuote, GoldForBusinessesQuoteInput, GoldForBusinessesState } from "@/types/goldForBusinesses.type";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";

const goldForBusinessesPath = "/api/v1/subscriptions/gold-for-businesses";

export const goldForBusinessesService = {
  fetchGoldForBusinesses: () => sendRequestToWebappServer<GoldForBusinessesState>(goldForBusinessesPath),
  quoteGoldForBusinesses: (input: GoldForBusinessesQuoteInput, signal?: AbortSignal) =>
    sendRequestToWebappServer<GoldForBusinessesQuote>(`${goldForBusinessesPath}/quote`, { method: "POST", body: input, signal }),
  startGoldForBusinessesCheckout: (input: GoldForBusinessesCheckoutInput) =>
    sendRequestToWebappServer<GoldForBusinessesCheckout>(`${goldForBusinessesPath}/checkout`, { method: "POST", body: input, idempotencyKey: createIdempotencyKey("gold-businesses") }),
  changeGoldForBusinessesProfiles: (subscriptionId: ID, profileIds: readonly ID[], expectedChargeMinor?: number) =>
    sendRequestToWebappServer<GoldForBusinessesProfilesChange>(`${goldForBusinessesPath}/${encodeURIComponent(subscriptionId)}/profiles`, {
      method: "PUT",
      body: expectedChargeMinor === undefined ? { profileIds } : { profileIds, expectedChargeMinor },
      idempotencyKey: createIdempotencyKey("gold-businesses-change"),
    }),
};
