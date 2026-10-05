import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";

import { useLiveGiftLeaderboard } from "./liveGiftStats.hook";
import { liveGlass } from "../liveSurface.constant";

const RANK_RING_COLORS = ["#FFC233", "#C9D1DC", "#D9893D"] as const;

export function LiveTopGiftersChip({ liveId, onPress }: { liveId: string; onPress: () => void }) {
  const topGifters = (useLiveGiftLeaderboard(liveId, true).data?.data ?? []).slice(0, 3);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Top supporters ranking" onPress={onPress} style={styles.chip} hitSlop={8}>
      <View style={styles.avatars}>
        {topGifters.map((gifter, index) => (
          <Avatar key={gifter.user.id} uri={gifter.user.avatarUrl} size={22} style={[styles.avatar, { borderColor: RANK_RING_COLORS[index], marginLeft: index === 0 ? 0 : -7 }]} />
        ))}
      </View>
      <Text size={11} weight={600} lineHeight={14} color={liveGlass.ink}>
        {topGifters.length ? "Top supporters" : "Be the first to support"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, paddingRight: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: liveGlass.background, borderWidth: StyleSheet.hairlineWidth, borderColor: liveGlass.border, alignSelf: "flex-start" },
  avatars: { flexDirection: "row" },
  avatar: { borderWidth: 1.5 },
});
