import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LiveBattle } from "@/types/liveStage.type";

import { describeBattleRule, findSingleBattleWinner } from "./battleStandings.util";

export function BattleHistoryCard({ battle, onDismiss }: { battle: LiveBattle; onDismiss?: () => void }) {
  const winner = findSingleBattleWinner(battle);
  const standings = [...battle.participants].sort((a, b) => b.score - a.score);
  const payoutFor = (userId: string) => battle.payouts.find((payout) => payout.userId === userId);
  const describePayout = (userId: string) => {
    const payout = payoutFor(userId);
    if (!payout) return "";
    const paidToHost = payout.paidToUserId !== userId ? " (paid to host)" : "";
    return `→ ${payout.earnedCoins.toLocaleString("en-US")} earned${paidToHost}`;
  };
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.headerRow}>
        <Text size={13} weight={700} lineHeight={16} color={colors.white} style={styles.flex}>
          {winner ? `🏆 ${winner.user.name} won` : "🤝 Draw"} · {Math.round(battle.durationSeconds / 60)} min · {describeBattleRule(battle.winnerTakesAll)}
        </Text>
        {onDismiss ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss battle summary" hitSlop={10} onPress={onDismiss}>
            <Cancel20Icon color={colors.white} />
          </Pressable>
        ) : null}
      </View>
      {standings.map((participant) => (
        <View key={participant.user.id} style={styles.row}>
          <Text size={12} lineHeight={15} color={colors.white} numberOfLines={1} style={styles.flex}>
            {participant.user.name}
            {participant.state !== "active" ? " (left)" : ""}
          </Text>
          <Text size={12} lineHeight={15} color="rgba(255,255,255,0.8)">
            {participant.score.toLocaleString("en-US")} received {describePayout(participant.userId)}
          </Text>
        </View>
      ))}
      {battle.mvpGifter ? (
        <Text size={11} lineHeight={14} color="rgba(255,255,255,0.8)">
          ⭐ MVP supporter: @{battle.mvpGifter.user.username}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 12, padding: 10, gap: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
});
