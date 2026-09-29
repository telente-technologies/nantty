import { BLUE_VERIFICATION_TIERS, type BlueVerificationTier, type PersonalVerificationLookup } from "../../../interfaces/creatorEligibility.interface.js";
import type { VerificationBadgeLookup } from "../../../interfaces/verificationBadge.interface.js";

export class BadgeBackedPersonalVerification implements PersonalVerificationLookup {
  public constructor(private readonly badges: VerificationBadgeLookup) {}

  public async findPublicBlueTier(userId: string): Promise<BlueVerificationTier | null> {
    const badge = (await this.badges.findVerificationBadges([userId])).get(userId);
    if (badge === undefined || badge.color !== "BLUE" || badge.status !== "VERIFIED" || badge.tier === null) return null;
    if (!(BLUE_VERIFICATION_TIERS as readonly string[]).includes(badge.tier)) return null;
    return badge.tier === "ESSENTIAL" || badge.badgeVisible ? (badge.tier as BlueVerificationTier) : null;
  }
}
