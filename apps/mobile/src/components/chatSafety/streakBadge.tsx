import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { ChatStreak } from "@/types";
import { Flame24Icon, HeartBroken24Icon, Hourglass24Icon, Medal24Icon } from "@/components/icons";

const STREAK_FLAME_COLOR = "#F97316";
const STREAK_MEDAL_COLOR = "#F59E0B";

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
      {isBroken ? <HeartBroken24Icon size={size + 4} color={colors.textMuted} /> : <Flame24Icon size={size + 4} color={STREAK_FLAME_COLOR} />}
      {isBroken ? null : (
        <Text size={size} weight={600} lineHeight={size + 4} color={colors.text}>{streak.count}</Text>
      )}
      {streak.hourglass ? <Hourglass24Icon size={size + 2} color={colors.error} /> : null}
      {streak.milestoneDays ? <Medal24Icon size={size + 2} color={STREAK_MEDAL_COLOR} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 2 } });
