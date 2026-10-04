import type { PreferenceCategory } from "../types/notification.type.js";

export const preferenceCategories: readonly PreferenceCategory[] = [
  "auth", "orders", "escrow", "seller", "payments", "creator", "checkmarks", "social", "milestones", "live", "trust", "privacy", "support", "marketing",
];

export const lockedPreferenceCategories: ReadonlySet<PreferenceCategory> = new Set(["auth", "trust", "privacy"]);

export const defaultPushEnabledByCategory: Readonly<Record<PreferenceCategory, boolean>> = {
  auth: true, orders: true, escrow: true, seller: true, payments: true, creator: true, checkmarks: true,
  social: true, milestones: true, live: true, trust: true, privacy: true, support: true, marketing: false,
};

export const defaultEmailEnabledByCategory: Readonly<Record<PreferenceCategory, boolean>> = {
  auth: true, orders: true, escrow: true, seller: true, payments: true, creator: true, checkmarks: true,
  social: true, milestones: true, live: false, trust: true, privacy: true, support: true, marketing: true,
};
