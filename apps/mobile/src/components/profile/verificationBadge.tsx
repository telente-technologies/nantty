import { View } from "react-native";

import { SealCheck20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import { useTheme } from "@/theme";
import type { Verification, VerificationColor } from "@/types";
import { isColorAllowedForProfileType, isInBlackGracePeriod } from "@/utils/verificationProfile.util";

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
  readonly checkmarkColor?: VerificationColor | null;
  readonly legacyVerified?: boolean;
  readonly size?: number;
  readonly viewerIsStaff?: boolean;
}

export const isVerificationBadgeVisible = (verification?: Verification | null) => {
  if (!verification || !verification.badgeVisible || verification.tier === "ESSENTIAL") return false;
  if (!isColorAllowedForProfileType(verification.type, verification.color)) return false;
  return verification.status === "active" || isInBlackGracePeriod(verification);
};

export function VerificationBadge({ verification, checkmarkColor, legacyVerified = false, size = 16, viewerIsStaff = false }: VerificationBadgeProps) {
  const theme = useTheme();
  const visible = checkmarkColor ? true : verification ? isVerificationBadgeVisible(verification) : legacyVerified;
  if (!visible) return null;
  const badgeColorName = checkmarkColor ?? verification?.color ?? "blue";
  const badgeColor = theme.isDark && badgeColorName !== "gold" ? theme.colors[badgeColorName === "black" ? "text" : "primary"] : VERIFICATION_BADGE_COLORS[badgeColorName];
  const renewalDue = viewerIsStaff && isInBlackGracePeriod(verification);
  return (
    <View accessible accessibilityLabel={`${ACCESSIBILITY_LABELS[badgeColorName]}${renewalDue ? ", renewal due" : ""}`} style={{ flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 4 }}>
      <SealCheck20Icon size={size} color={badgeColor} />
      {renewalDue ? <Text size={11} weight={500} color={theme.colors.error}>Renewal due</Text> : null}
    </View>
  );
}
