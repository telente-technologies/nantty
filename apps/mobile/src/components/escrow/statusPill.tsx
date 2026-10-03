import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import { darkStatusTones, useTheme } from "@/theme";

export type StatusTone = "primary" | "success" | "caution" | "error" | "neutral";

const TONE_COLORS: Record<StatusTone, { background: string; text: string }> = {
  primary: { background: palette.primary[50], text: colors.primary },
  success: { background: palette.success[50], text: palette.success[700] },
  caution: { background: palette.caution[50], text: palette.caution[700] },
  error: { background: palette.error[50], text: palette.error[600] },
  neutral: { background: colors.skeleton, text: colors.textMuted },
};

export function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const { isDark } = useTheme();
  const toneColors = isDark ? darkStatusTones[tone] : TONE_COLORS[tone];
  return (
    <View style={[styles.pill, { backgroundColor: toneColors.background }]}>
      <Text size={12} weight={500} lineHeight={16} color={toneColors.text}>
        {label}
      </Text>
    </View>
  );
}

export const toneBackgroundColor = (tone: StatusTone) => TONE_COLORS[tone].background;
export const toneTextColor = (tone: StatusTone) => TONE_COLORS[tone].text;

const styles = StyleSheet.create({ pill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 } });
