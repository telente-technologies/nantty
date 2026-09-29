import type {
  ProfileType,
  VerificationColor,
  VerificationStatus,
  VerificationTier,
  VerificationType,
} from "../../../interfaces/verificationBadge.interface.js";

export function findColorForProfileType(profileType: ProfileType): VerificationColor {
  if (profileType === "PERSONAL") return "BLUE";
  if (profileType === "GOVERNMENT") return "BLACK";
  return "GOLD";
}

export function findVerificationTypeForProfileType(profileType: ProfileType): VerificationType {
  if (profileType === "PERSONAL") return "PERSONAL";
  if (profileType === "GOVERNMENT") return "GOVERNMENT";
  return "BUSINESS";
}

export function listTiersForProfileType(profileType: ProfileType): readonly VerificationTier[] {
  if (profileType === "PERSONAL") return ["ESSENTIAL", "VERIFIED", "PREMIUM"];
  if (profileType === "GOVERNMENT") return ["OFFICIAL"];
  return ["PRO", "PREMIUM"];
}

export function isTierValidForProfileType(profileType: ProfileType, tier: VerificationTier): boolean {
  return listTiersForProfileType(profileType).includes(tier);
}

export function isBadgeVisible(status: VerificationStatus, tier: VerificationTier | null): boolean {
  if (status !== "VERIFIED" || tier === null) return false;
  return tier === "VERIFIED" || tier === "PREMIUM" || tier === "PRO" || tier === "OFFICIAL";
}

export function canVerificationTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  if (to === "PENDING") return from !== "PENDING";
  if (to === "VERIFIED") return from === "PENDING";
  if (to === "SUSPENDED") return from === "VERIFIED";
  if (to === "REVOKED") return from === "VERIFIED" || from === "SUSPENDED";
  return from === "PENDING";
}
