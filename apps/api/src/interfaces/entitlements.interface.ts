import type { VerificationColor, VerificationTier } from "./verificationBadge.interface.js";

export const ENTITLEMENT_VALUE_TYPES = {
  "security.two_factor_required": "boolean",
  "security.login_alerts": "boolean",
  "security.impersonation_protection": "boolean",
  "ads.level": "text",
  "ads.monthly_credit_minor": "number",
  "badge.visible": "boolean",
  "support.priority": "boolean",
  "posts.max_video_seconds": "number",
  "posts.edit_window_minutes": "number",
  "creator_program.eligible": "boolean",
  "reach.boost": "boolean",
  "analytics.profile": "boolean",
  "features.early_access": "boolean",
  "analytics.business": "boolean",
  "seller.dashboard": "boolean",
  "seller.pos": "boolean",
  "store.staff_seats": "number",
  "store.locations": "number",
  "marketplace.commission_bps": "number",
  "placement.priority": "boolean",
  "api.access": "boolean",
  "moderation.priority": "boolean",
} as const;

export type EntitlementKey = keyof typeof ENTITLEMENT_VALUE_TYPES;
export type EntitlementValue = boolean | number | string;
export type EntitlementSet = Readonly<Partial<Record<EntitlementKey, EntitlementValue>>>;

export const UNLIMITED_ENTITLEMENT_QUANTITY = -1;

export interface ProfileEntitlements {
  readonly profileId: string;
  readonly color: VerificationColor | null;
  readonly tier: VerificationTier | null;
  readonly subscriptionStatus: string | null;
  readonly entitlements: EntitlementSet;
}

export interface EntitlementsLookup {
  findEntitlementsForUser(userId: string): Promise<ProfileEntitlements>;
  findEntitlementsForStore(storeId: string): Promise<ProfileEntitlements>;
}
