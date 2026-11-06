import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { LiveBattle } from "@/types/liveStage.type";

import { describeBattleRule, findSingleBattleWinner } from "./battleStandings.util";
import { liveGlass } from "../liveSurface.constant";
import { Handshake24Icon, Star16Icon, Trophy24Icon } from "@/components/icons";
import { IconRow } from "@/components/ui/iconRow";

export function BattleHistoryCard({ battle, onDismiss }: { battle: LiveBattle; onDismiss?: () => void }) {
  const winner = findSingleBattleWinner(battle);
  const standings = [...battle.participants].sort((a, b) => b.score - a.score);
  const payoutFor = (userId: string) => battle.payouts.find((payout) => payout.userId === userId);
  const describePayout = (userId: string) => {
    const payout = payoutFor(userId);
    if (!payout) return "";
    const paidToHost = payout.paidToUserId !== userId ? " (paid to host)" : "";
    return `${payout.earnedCoins.toLocaleString("en-US")} earned${paidToHost}`;
  };
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.headerRow}>
        {winner ? <Trophy24Icon size={16} color={liveGlass.ink} /> : <Handshake24Icon size={16} color={liveGlass.ink} />}
        <Text size={13} weight={700} lineHeight={16} color={liveGlass.ink} style={styles.flex}>
          {winner ? `${winner.user.name} won` : "Draw"} · {Math.round(battle.durationSeconds / 60)} min · {describeBattleRule(battle.winnerTakesAll)}
        </Text>
        {onDismiss ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss battle summary" hitSlop={10} onPress={onDismiss}>
            <Cancel20Icon color={liveGlass.ink} />
          </Pressable>
        ) : null}
      </View>
      {standings.map((participant) => (
        <View key={participant.user.id} style={styles.row}>
          <Text size={12} lineHeight={15} color={liveGlass.ink} numberOfLines={1} style={styles.flex}>
            {participant.user.name}
            {participant.state !== "active" ? " (left)" : ""}
          </Text>
          <Text size={12} lineHeight={15} color={liveGlass.inkMuted}>
            {participant.score.toLocaleString("en-US")} received {describePayout(participant.userId)}
          </Text>
        </View>
      ))}
      {battle.mvpGifter ? (
        <IconRow icon={<Star16Icon size={12} color={liveGlass.inkMuted} />}>
          <Text size={11} lineHeight={14} color={liveGlass.inkMuted}>
            Top coin supporter: @{battle.mvpGifter.user.username}
          </Text>
        </IconRow>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: liveGlass.backgroundStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: liveGlass.border, borderRadius: 12, padding: 10, gap: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
});
