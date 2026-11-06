import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { liveAccent, liveGlass } from "../liveSurface.constant";
import type { LiveBattle } from "@/types/liveStage.type";

import { findSingleBattleWinner } from "./battleStandings.util";
import { Handshake24Icon, Hourglass24Icon, Star16Icon, Trophy24Icon } from "@/components/icons";
import { IconRow } from "@/components/ui/iconRow";

const WINNER_PRAISE_LINES = ["Unstoppable!", "What a performance!", "The crowd has spoken!", "Champion energy!"];

export function BattleResultBanner({ battle }: { battle: LiveBattle }) {
  if (battle.state !== "settled") {
    return (
      <View style={styles.banner} accessibilityLiveRegion="polite">
        <IconRow icon={<Hourglass24Icon size={16} color={liveGlass.ink} />} justify="center">
          <Text size={13} weight={600} lineHeight={16} color={liveGlass.ink} align="center">
            Time! Counting the coins…
          </Text>
        </IconRow>
      </View>
    );
  }
  const winner = findSingleBattleWinner(battle);
  if (!winner) {
    return (
      <View style={styles.banner} accessibilityLiveRegion="polite">
        <IconRow icon={<Handshake24Icon size={22} color={liveGlass.ink} />} justify="center" gap={6}>
          <Text size={18} weight={700} lineHeight={22} color={liveGlass.ink} align="center">
            It's a draw!
          </Text>
        </IconRow>
        <Text size={12} lineHeight={16} color={liveGlass.inkMuted} align="center">
          No single winner, so everyone keeps the coins they received.
        </Text>
      </View>
    );
  }
  const praise = WINNER_PRAISE_LINES[battle.id.length % WINNER_PRAISE_LINES.length];
  const transferredCoins = battle.transfers.reduce((sum, transfer) => sum + transfer.coins, 0);
  return (
    <View style={[styles.banner, styles.winnerBanner]} accessibilityLiveRegion="polite">
      <IconRow icon={<Trophy24Icon size={22} color={liveAccent.goldInk} />} justify="center" gap={6}>
        <Text size={18} weight={700} lineHeight={22} color={liveAccent.goldInk} align="center" style={{ flexShrink: 1 }}>
          {winner.user.name} wins! {praise}
        </Text>
      </IconRow>
      <Text size={12} weight={500} lineHeight={16} color={liveAccent.goldInk} align="center">
        {winner.score.toLocaleString("en-US")} coins
        {transferredCoins > 0 ? ` · +${transferredCoins.toLocaleString("en-US")} from winner takes all` : ""}
      </Text>
      {battle.mvpGifter ? (
        <IconRow icon={<Star16Icon size={14} color={liveAccent.goldInk} />} justify="center">
          <Text size={12} lineHeight={16} color={liveAccent.goldInk} align="center" style={{ flexShrink: 1 }}>
            Top coin supporter: @{battle.mvpGifter.user.username} ({battle.mvpGifter.coins.toLocaleString("en-US")} coins)
          </Text>
        </IconRow>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: "center",
    maxWidth: "92%",
    backgroundColor: liveGlass.backgroundStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: liveGlass.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  winnerBanner: { backgroundColor: liveAccent.gold, borderColor: "rgba(26, 20, 0, 0.16)" },
});
