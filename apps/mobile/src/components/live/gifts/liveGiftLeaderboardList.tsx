import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import type { LiveGiftLeaderboardEntry } from "@/types";
import { makeThemedStyles, useTheme } from "@/theme";

export function LiveGiftLeaderboardList({ entries, emptyMessage }: { entries: readonly LiveGiftLeaderboardEntry[]; emptyMessage: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (entries.length === 0) {
    return (
      <Text size={13} lineHeight={18} color={colors.textMuted} align="center">
        {emptyMessage}
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {entries.map((entry) => (
        <View key={entry.user.id} style={styles.row} accessibilityLabel={`Rank ${entry.rank}, ${entry.user.name}, ${entry.points} points`}>
          <Text size={14} weight={700} lineHeight={18} color={entry.rank <= 3 ? colors.primary : colors.textMuted} style={styles.rank}>
            {entry.rank}
          </Text>
          <Avatar uri={entry.user.avatarUrl} size={32} />
          <View style={styles.names}>
            <Text size={14} weight={600} lineHeight={18} numberOfLines={1}>
              {entry.user.name}
            </Text>
            <Text size={12} lineHeight={15} color={colors.textMuted} numberOfLines={1}>
              @{entry.user.username}
            </Text>
          </View>
          <Text size={13} weight={600} lineHeight={18}>
            {entry.points.toLocaleString("en-US")} pts
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rank: { width: 20, textAlign: "center" },
  names: { flex: 1 },
}));
