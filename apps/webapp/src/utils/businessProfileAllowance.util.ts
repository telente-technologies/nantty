import type { BusinessProfileAllowance, LinkedProfileItem } from "@/types/brand.type";

export const STORE_BADGE_TEXT = "Store";
export const PREMIUM_BUSINESS_PROFILES_UPSELL = "Get Blue Premium for up to 5 business profiles";

export type BusinessProfileAllowanceState = "available" | "upgradeForMore" | "premiumLimitReached" | "premiumNeeded";

export function describeBusinessProfileAllowance(allowance: BusinessProfileAllowance): string {
  return allowance.premium ? `${allowance.count} of ${allowance.limit} business profiles (Premium)` : `${allowance.count} of ${allowance.limit} business profiles`;
}

export function readBusinessProfileAllowanceState(allowance: BusinessProfileAllowance): BusinessProfileAllowanceState {
  if (allowance.premiumNeeded) return "premiumNeeded";
  if (allowance.count < allowance.limit) return "available";
  return allowance.premium ? "premiumLimitReached" : "upgradeForMore";
}

export function describePremiumNeededForBusinessProfiles(standardLimit: number): string {
  return `Premium needed for more than ${standardLimit} business profiles`;
}

export function describeBusinessProfileAllowanceNotice(allowance: BusinessProfileAllowance, standardLimit = 2): string | null {
  const state = readBusinessProfileAllowanceState(allowance);
  if (state === "premiumNeeded") return `${describePremiumNeededForBusinessProfiles(standardLimit)}. Your profiles keep working and nothing is deleted, but you can't add new ones until Blue Premium is back.`;
  if (state === "upgradeForMore") return `You've used all ${allowance.limit} business profiles. ${PREMIUM_BUSINESS_PROFILES_UPSELL}.`;
  if (state === "premiumLimitReached") return `You've reached the limit of ${allowance.limit} business profiles.`;
  return null;
}

export function shouldShowStoreBadge(item: Pick<LinkedProfileItem, "ownsStore">): boolean {
  return item.ownsStore === true;
}

const profileLimitErrorCopy: Readonly<Record<string, string>> = {
  STORE_LIMIT_ONE: "You can own one store. Your other business profiles can be Business pages or Brands, which don't sell in Mart.",
  BUSINESS_PROFILE_LIMIT: "You've reached the limit of 5 business profiles.",
  PROFILE_ALREADY_HAS_GOLD: "One of these businesses already has its own Gold plan. Untick it and try again.",
  PROFILE_COVERED_BY_COMBINED_GOLD: "One of these businesses is already covered by Gold for all your businesses.",
  COMBINED_GOLD_TOO_MANY_PROFILES: "You can cover up to 5 businesses on one Gold plan.",
};

export function describeProfileLimitError(code: string | null | undefined): string | null {
  return code ? profileLimitErrorCopy[code] ?? null : null;
}
