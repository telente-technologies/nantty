import type { GoldBillingInterval, GoldForBusinessesState } from "@/types/goldForBusinesses.type";

export interface GoldForBusinessesHandoffSelection {
  readonly profileIds: readonly string[];
  readonly interval: GoldBillingInterval;
}

export function readGoldForBusinessesHandoff(search: string, state: GoldForBusinessesState): GoldForBusinessesHandoffSelection {
  const params = new URLSearchParams(search);
  const eligibleProfileIds = new Set(state.businesses.filter((business) => !business.hasOwnGold).map((business) => business.profileId));
  const requested = (params.get("goldProfiles") ?? "").split(",").map((profileId) => profileId.trim()).filter((profileId) => eligibleProfileIds.has(profileId));
  const profileIds = state.premium ? [...new Set(requested)].slice(0, state.rules.maximumProfiles) : [];
  return { profileIds, interval: params.get("goldInterval") === "year" ? "year" : "month" };
}

export const readGoldForBusinessesHandoffFromLocation = (state: GoldForBusinessesState): GoldForBusinessesHandoffSelection =>
  readGoldForBusinessesHandoff(typeof window === "undefined" ? "" : window.location.search, state);
