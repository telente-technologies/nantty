import type { StorePolicies } from "@/types/store.type";
import type { StorefrontFeaturedProduct, StorefrontOpeningHours, StorefrontProfile, StorefrontSocialLinks, StorefrontUpdateRequest } from "@/types/storefront.type";

export interface StorefrontDraft {
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly logoUrl: string | null;
  readonly logoMediaId: string | null | undefined;
  readonly coverUrl: string | null;
  readonly coverMediaId: string | null | undefined;
  readonly policies: StorePolicies;
  readonly openingHours: StorefrontOpeningHours[];
  readonly socialLinks: StorefrontSocialLinks;
  readonly featuredProducts: StorefrontFeaturedProduct[];
}

export type StorefrontDraftUpdater = (patch: Partial<StorefrontDraft>) => void;

export function convertStorefrontProfileToDraft(profile: StorefrontProfile): StorefrontDraft {
  return {
    name: profile.name,
    tagline: profile.tagline,
    description: profile.description,
    logoUrl: profile.logoUrl,
    logoMediaId: undefined,
    coverUrl: profile.coverUrl,
    coverMediaId: undefined,
    policies: profile.policies,
    openingHours: profile.openingHours,
    socialLinks: profile.socialLinks,
    featuredProducts: profile.featuredProducts,
  };
}

export function convertStorefrontDraftToUpdateRequest(draft: StorefrontDraft): StorefrontUpdateRequest {
  return {
    name: draft.name.trim(),
    tagline: draft.tagline.trim(),
    description: draft.description.trim(),
    ...(draft.logoMediaId !== undefined ? { logoMediaId: draft.logoMediaId } : {}),
    ...(draft.coverMediaId !== undefined ? { coverMediaId: draft.coverMediaId } : {}),
    policies: draft.policies,
    openingHours: draft.openingHours,
    socialLinks: Object.fromEntries(Object.entries(draft.socialLinks).map(([network, link]) => [network, link?.trim() ? link.trim() : null])) as StorefrontSocialLinks,
    featuredProductIds: draft.featuredProducts.map((product) => product.productId),
  };
}

export function findStorefrontDraftProblems(draft: StorefrontDraft): string[] {
  const problems: string[] = [];
  if (draft.name.trim().length < 2) problems.push("Your store name needs at least 2 characters.");
  if (draft.tagline.length > 80) problems.push("Keep the tagline under 80 characters.");
  if (draft.description.length > 500) problems.push("Keep the description under 500 characters.");
  for (const [network, link] of Object.entries(draft.socialLinks)) {
    if (link && link.trim() && !/^https:\/\/\S{3,}$/.test(link.trim())) problems.push(`The ${network} link must start with https://.`);
  }
  for (const hours of draft.openingHours) {
    if (hours.isOpen && hours.opensAt >= hours.closesAt) problems.push(`On ${weekdayLabels[hours.weekday]}, opening time must be before closing time.`);
  }
  return problems;
}

export const weekdayLabels: Record<StorefrontOpeningHours["weekday"], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
