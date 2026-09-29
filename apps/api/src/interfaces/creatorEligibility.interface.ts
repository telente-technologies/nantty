export const BLUE_VERIFICATION_TIERS = ["ESSENTIAL", "VERIFIED", "PREMIUM"] as const;
export type BlueVerificationTier = (typeof BLUE_VERIFICATION_TIERS)[number];

export interface PersonalVerificationLookup {
  findPublicBlueTier(userId: string): Promise<BlueVerificationTier | null>;
}
