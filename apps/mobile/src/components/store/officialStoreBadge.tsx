import { StyleSheet, View } from "react-native";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Text } from "@/components/ui/text";
import { palette } from "@/constants/colors.constant";

const OFFICIAL_STORE_BADGE_VERIFICATION = { status: "active", type: "business", color: "gold", tier: "PRO", badgeVisible: true } as const;

export function OfficialStoreBadge() {
  return (
    <View style={styles.row} accessible accessibilityLabel="Official Store">
      <VerificationBadge verification={OFFICIAL_STORE_BADGE_VERIFICATION} size={14} />
      <Text size={12} weight={500} lineHeight={14.4} color={palette.secondary[800]}>Official Store</Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 3 } });
