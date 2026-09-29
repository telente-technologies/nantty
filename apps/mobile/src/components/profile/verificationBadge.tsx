import { View } from "react-native";

import { SealCheck20Icon } from "@/components/icons";
import { colors, palette } from "@/constants/colors.constant";
import type { Verification, VerificationColor } from "@/types";

export const VERIFICATION_BADGE_COLORS: Record<VerificationColor, string> = {
  blue: colors.primary,
  gold: palette.secondary[600],
  black: colors.black,
};

const ACCESSIBILITY_LABELS: Record<VerificationColor, string> = {
  blue: "Verified account",
  gold: "Verified business",
  black: "Official government account",
};

export interface VerificationBadgeProps {
  readonly verification?: Verification | null;
  readonly legacyVerified?: boolean;
  readonly size?: number;
}

export const isVerificationBadgeVisible = (verification?: Verification | null) =>
  !!verification && verification.badgeVisible && verification.status === "active" && verification.tier !== "ESSENTIAL";

export function VerificationBadge({ verification, legacyVerified = false, size = 16 }: VerificationBadgeProps) {
  const visible = verification ? isVerificationBadgeVisible(verification) : legacyVerified;
  if (!visible) return null;
  const badgeColor = VERIFICATION_BADGE_COLORS[verification?.color ?? "blue"];
  return (
    <View accessible accessibilityLabel={ACCESSIBILITY_LABELS[verification?.color ?? "blue"]} style={{ flexShrink: 0 }}>
      <SealCheck20Icon size={size} color={badgeColor} />
    </View>
  );
}
