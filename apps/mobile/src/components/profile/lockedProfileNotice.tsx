import { StyleSheet, View } from "react-native";

import { LockSimple24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import { makeThemedStyles, useTheme } from "@/theme";

import type { LockedProfileCopy } from "./followState.util";

export function LockedProfileNotice({ copy }: { readonly copy: LockedProfileCopy }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.notice} accessibilityRole="summary" accessibilityLabel={`${copy.title}. ${copy.message}`}>
      <View style={styles.lockCircle}>
        <LockSimple24Icon size={28} color={colors.text} />
      </View>
      <Text size={typeScale.base} weight={600} lineHeight={20} align="center">{copy.title}</Text>
      <Text size={typeScale.md} lineHeight={18} color={colors.textSubtle} align="center">{copy.message}</Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  notice: { marginTop: 40, paddingHorizontal: spacing[7], alignItems: "center", gap: 6 },
  lockCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.text, alignItems: "center", justifyContent: "center", marginBottom: 8 },
}));
