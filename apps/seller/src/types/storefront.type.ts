import type { Money } from "@/types/money.type";
import type { StorePolicies } from "@/types/store.type";

export const storefrontWeekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type StorefrontWeekday = (typeof storefrontWeekdays)[number];

export interface StorefrontOpeningHours {
  readonly weekday: StorefrontWeekday;
  readonly isOpen: boolean;
  readonly opensAt: string;
  readonly closesAt: string;
}

export const storefrontSocialNetworks = ["instagram", "tiktok", "x", "whatsapp", "facebook", "website"] as const;
export type StorefrontSocialNetwork = (typeof storefrontSocialNetworks)[number];
export type StorefrontSocialLinks = Record<StorefrontSocialNetwork, string | null>;

export interface StorefrontFeaturedProduct {
  readonly productId: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly price: Money;
  readonly isAvailable: boolean;
}

export interface StorefrontProfile {
  readonly storeId: string;
  readonly name: string;
  readonly handle: string;
  readonly publicUrl: string;
  readonly logoUrl: string | null;
  readonly coverUrl: string | null;
  readonly tagline: string;
  readonly description: string;
  readonly policies: StorePolicies;
  readonly openingHours: StorefrontOpeningHours[];
  readonly socialLinks: StorefrontSocialLinks;
  readonly featuredProducts: StorefrontFeaturedProduct[];
  readonly deliveryAreas: string[];
  readonly followerCount: number;
  readonly averageRating: number | null;
  readonly updatedAt: string;
}

export interface StorefrontUpdateRequest {
  readonly name?: string;
  readonly tagline?: string;
  readonly description?: string;
  readonly logoMediaId?: string | null;
  readonly coverMediaId?: string | null;
  readonly policies?: StorePolicies;
  readonly openingHours?: StorefrontOpeningHours[];
  readonly socialLinks?: StorefrontSocialLinks;
  readonly featuredProductIds?: string[];
}
