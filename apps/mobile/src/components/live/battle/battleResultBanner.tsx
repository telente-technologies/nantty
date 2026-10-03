import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LiveBattle } from "@/types/liveStage.type";

import { findSingleBattleWinner } from "./battleStandings.util";

const WINNER_PRAISE_LINES = ["Unstoppable!", "What a performance!", "The crowd has spoken!", "Champion energy!"];

export function BattleResultBanner({ battle }: { battle: LiveBattle }) {
  if (battle.state !== "settled") {
    return (
      <View style={styles.banner} accessibilityLiveRegion="polite">
        <Text size={13} weight={600} lineHeight={16} color={colors.white} align="center">
          ⏱ Time! Counting the coins…
        </Text>
      </View>
    );
  }
  const winner = findSingleBattleWinner(battle);
  if (!winner) {
    return (
      <View style={styles.banner} accessibilityLiveRegion="polite">
        <Text size={18} weight={700} lineHeight={22} color={colors.white} align="center">
          🤝 It's a draw!
        </Text>
        <Text size={12} lineHeight={16} color="rgba(255,255,255,0.85)" align="center">
          No single winner, so everyone keeps the coins they received.
        </Text>
      </View>
    );
  }
  const praise = WINNER_PRAISE_LINES[battle.id.length % WINNER_PRAISE_LINES.length];
  const transferredCoins = battle.transfers.reduce((sum, transfer) => sum + transfer.coins, 0);
  return (
    <View style={[styles.banner, styles.winnerBanner]} accessibilityLiveRegion="polite">
      <Text size={18} weight={700} lineHeight={22} color={colors.black} align="center">
        🏆 {winner.user.name} wins! {praise}
      </Text>
      <Text size={12} weight={500} lineHeight={16} color={colors.black} align="center">
        {winner.score.toLocaleString("en-US")} coins
        {transferredCoins > 0 ? ` · +${transferredCoins.toLocaleString("en-US")} from winner takes all` : ""}
      </Text>
      {battle.mvpGifter ? (
        <Text size={12} lineHeight={16} color={colors.black} align="center">
          ⭐ MVP supporter: @{battle.mvpGifter.user.username} ({battle.mvpGifter.coins.toLocaleString("en-US")} coins)
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: "center",
    maxWidth: "92%",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 2,
  },
  winnerBanner: { backgroundColor: "#FFD54A" },
});
