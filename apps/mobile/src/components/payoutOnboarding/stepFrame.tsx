import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

interface StepFrameProps {
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly title: string;
  readonly why: string;
  readonly children: ReactNode;
}

export function StepFrame({ stepNumber, stepCount, title, why, children }: StepFrameProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.frame}>
      <View style={styles.bars} accessibilityLabel={`Step ${stepNumber} of ${stepCount}`}>
        {Array.from({ length: stepCount }, (_, index) => (
          <View key={index} style={[styles.bar, index < stepNumber && styles.barDone]} />
        ))}
      </View>
      <Text size={12} lineHeight={14.4} color={colors.textMuted}>Step {stepNumber} of {stepCount}</Text>
      <Text size={22} weight={600} lineHeight={28} accessibilityRole="header">{title}</Text>
      <View style={styles.why}>
        <Text size={13} weight={600} lineHeight={16.9}>Why we need this</Text>
        <Text size={13} lineHeight={18.2} color={colors.textMuted}>{why}</Text>
      </View>
      {children}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  frame: { gap: 14 },
  bars: { flexDirection: "row", gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface },
  barDone: { backgroundColor: colors.primary },
  why: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 12, gap: 4 },
}));
