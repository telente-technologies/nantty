import type { ActingProfile } from "@/types/brand.type";
import type { Verification, VerificationColor, VerificationProfileType } from "@/types/models.type";

export const COLOR_BY_PROFILE_TYPE: Record<VerificationProfileType, VerificationColor> = { personal: "blue", business: "gold", government: "black" };

export const profileTypeForKind = (kind: ActingProfile["kind"] | null | undefined): VerificationProfileType => {
  if (kind === "business" || kind === "brand" || kind === "store") return "business";
  if (kind === "government") return "government";
  return "personal";
};

export const isColorAllowedForProfileType = (type: VerificationProfileType, color: VerificationColor) => COLOR_BY_PROFILE_TYPE[type] === color;

export const verificationForProfileKind = (verification: Verification | null | undefined, kind: ActingProfile["kind"]): Verification | null => {
  if (!verification) return null;
  return isColorAllowedForProfileType(profileTypeForKind(kind), verification.color) ? verification : null;
};

export const GRACE_PERIOD_DAYS = 14;

export const isInBlackGracePeriod = (verification: Verification | null | undefined, now = Date.now()) =>
  !!verification && verification.color === "black" && !!verification.graceEndsAt && verification.status === "expired" && Date.parse(verification.graceEndsAt) > now;

export const MANAGE_ON_THE_WEB_LABEL = "Manage on the web";
