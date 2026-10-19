import type { BusinessProfileAllowance, LinkedProfileItem, LinkedProfiles } from "@/types/brand.type";

export const BLUE_PREMIUM_PROFILES_UPSELL = "Get Blue Premium for up to 5 business profiles";
export const BUSINESS_PROFILE_LIMIT_REACHED = "You've reached the 5 business profiles Blue Premium includes";
export const STORE_BADGE_LABEL = "Store";
export const PREMIUM_NEEDED_LABEL = "Premium needed";

export type BusinessProfileCreationState = "open" | "premiumUpsell" | "premiumLimitReached" | "premiumNeeded";

export function describeBusinessProfileAllowance(allowance: BusinessProfileAllowance | undefined): string | null {
  if (!allowance) return null;
  const base = `${allowance.count} of ${allowance.limit} business profiles`;
  return allowance.premium ? `${base} (Premium)` : base;
}

export function describePremiumNeeded(allowance: BusinessProfileAllowance | undefined): string | null {
  if (!allowance?.premiumNeeded) return null;
  return `Premium needed for more than ${allowance.limit} business profiles`;
}

export function businessProfileCreationState(linked: LinkedProfiles | undefined): BusinessProfileCreationState {
  const allowance = linked?.businessProfiles;
  if (!linked || !allowance) return "open";
  if (linked.canCreate.business || linked.canCreate.brand || linked.canCreate.store) return "open";
  if (allowance.premiumNeeded) return "premiumNeeded";
  if (allowance.premium) return "premiumLimitReached";
  return "premiumUpsell";
}

export function shouldOfferBluePremium(linked: LinkedProfiles | undefined): boolean {
  const allowance = linked?.businessProfiles;
  if (!allowance || allowance.premium) return false;
  return !linked.canCreate.business || !linked.canCreate.brand || allowance.premiumNeeded;
}

export function linkedItemForProfile(linked: LinkedProfiles | undefined, profileId: string): LinkedProfileItem | null {
  return linked?.items.find((item) => item.profileId === profileId) ?? null;
}

export function linkedProfileBadges(item: Pick<LinkedProfileItem, "ownsStore" | "premiumNeeded"> | null | undefined): readonly string[] {
  if (!item) return [];
  return [item.ownsStore ? STORE_BADGE_LABEL : null, item.premiumNeeded ? PREMIUM_NEEDED_LABEL : null].filter((label): label is string => label !== null);
}

export function usesPremiumProfileLayout(linked: LinkedProfiles | undefined): boolean {
  const allowance = linked?.businessProfiles;
  return allowance !== undefined && (allowance.premium || allowance.premiumNeeded);
}
