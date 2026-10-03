import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { RankingEntry } from "@/types/socialGraph.type";

export function RankingRow({ entry }: { entry: RankingEntry }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={`Rank ${entry.rank}, ${entry.user.name}, ${entry.points} points`}>
      <Text size={14} weight={700} lineHeight={18} color={entry.rank <= 3 ? colors.primary : colors.textMuted} style={styles.rank}>
        {entry.rank}
      </Text>
      <Avatar uri={entry.user.avatarUrl} size={40} />
      <View style={styles.names}>
        <Text size={14} weight={600} lineHeight={18} numberOfLines={1}>{entry.user.name}</Text>
        <Text size={12} lineHeight={15} color={colors.textMuted} numberOfLines={1}>@{entry.user.username}</Text>
      </View>
      <Text size={13} weight={600} lineHeight={18}>{entry.points.toLocaleString("en-US")} pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, minHeight: 56 },
  rank: { width: 24, textAlign: "center" },
  names: { flex: 1 },
});
