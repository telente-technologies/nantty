import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export function ApplicationStepHeader({ stepNumber, totalSteps, title, subtitle }: { stepNumber: number; totalSteps: number; title: string; subtitle: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <View style={styles.track} accessibilityLabel={`Step ${stepNumber} of ${totalSteps}`}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <View key={index} style={[styles.segment, index < stepNumber && styles.segmentDone]} />
        ))}
      </View>
      <Text size={12} weight={500} lineHeight={14.4} color={colors.textSubtle}>
        Step {stepNumber} of {totalSteps}
      </Text>
      <Text size={21} weight={600} lineHeight={25.2} accessibilityRole="header">
        {title}
      </Text>
      <Text size={14} lineHeight={19.6} color={colors.textMuted}>
        {subtitle}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 8 },
  track: { flexDirection: "row", gap: 4, marginBottom: 8 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.divider },
  segmentDone: { backgroundColor: colors.primarySolid },
}));
