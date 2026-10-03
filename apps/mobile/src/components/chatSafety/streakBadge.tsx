import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { ChatStreak } from "@/types";

export interface StreakBadgeProps {
  readonly streak: ChatStreak | null | undefined;
  readonly size?: number;
}

export const describeStreakForAccessibility = (streak: ChatStreak) =>
  `${streak.count} day streak${streak.hourglass ? ", ending soon" : ""}${streak.milestoneDays ? `, ${streak.milestoneDays} day milestone` : ""}`;

export function StreakBadge({ streak, size = 12 }: StreakBadgeProps) {
  const { colors } = useTheme();
  if (!streak || (streak.state === "none")) return null;
  const isBroken = streak.state === "broken";
  return (
    <View accessible accessibilityLabel={isBroken ? "Streak lost, can be restored" : describeStreakForAccessibility(streak)} style={styles.row}>
      <Text size={size + 2} lineHeight={size + 6}>{isBroken ? "💔" : "🔥"}</Text>
      {isBroken ? null : (
        <Text size={size} weight={600} lineHeight={size + 4} color={colors.text}>{streak.count}</Text>
      )}
      {streak.hourglass ? <Text size={size + 1} lineHeight={size + 5}>⏳</Text> : null}
      {streak.milestoneDays ? <Text size={size + 1} lineHeight={size + 5}>🏅</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 2 } });
