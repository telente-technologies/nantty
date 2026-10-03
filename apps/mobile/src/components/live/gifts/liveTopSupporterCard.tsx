import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";

import { useLiveGiftLeaderboard } from "./liveGiftStats.hook";

export function LiveTopSupporterCard({ liveId }: { liveId: string }) {
  const leaderboard = useLiveGiftLeaderboard(liveId, true);
  const topSupporter = leaderboard.data?.data[0];
  if (!topSupporter) return null;
  return (
    <View style={styles.card} accessibilityLabel={`Top supporter ${topSupporter.user.name}, ${topSupporter.points} points`}>
      <Avatar uri={topSupporter.user.avatarUrl} size={36} style={styles.avatar} />
      <View style={styles.texts}>
        <Text size={11} weight={700} lineHeight={14} color="#B87900" letterSpacing={0.6}>
          TOP SUPPORTER
        </Text>
        <Text size={14} weight={600} lineHeight={18} numberOfLines={1}>
          {topSupporter.user.name}
        </Text>
      </View>
      <Text size={13} weight={700} lineHeight={18}>
        {topSupporter.points.toLocaleString("en-US")} pts
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#FFF6DB", minWidth: 240 },
  avatar: { borderWidth: 2, borderColor: "#FFC233" },
  texts: { flex: 1 },
});
