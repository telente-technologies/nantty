import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { LiveBattle } from "@/types/liveStage.type";

import { secondsRemainingUntil } from "./battleClock.hook";
import { BattleConfetti } from "./battleConfetti";
import { BattleResultBanner } from "./battleResultBanner";
import { BattleTugOfWarBar } from "./battleScoreBar";
import { BattleTimerPill } from "./battleTimerPill";
import { liveGlass } from "../liveSurface.constant";

const FINAL_SECONDS = 10;

export interface BattleStageOverlayProps {
  readonly battle: LiveBattle;
  readonly now: number;
  readonly gridHeight: number;
}

function BigCenterNumber({ value, isSubtle }: { value: string; isSubtle: boolean }) {
  return (
    <View style={styles.bigNumberWrap} pointerEvents="none">
      <Text size={isSubtle ? 64 : 88} weight={700} lineHeight={isSubtle ? 72 : 96} color={isSubtle ? "rgba(255,255,255,0.55)" : liveGlass.ink} style={styles.bigNumber}>
        {value}
      </Text>
    </View>
  );
}

export function BattleStageOverlay({ battle, now, gridHeight }: BattleStageOverlayProps) {
  const isTwoPlayer = battle.participants.length === 2;
  const countdownSeconds = secondsRemainingUntil(battle.startsAt, now);
  const battleSeconds = secondsRemainingUntil(battle.endsAt, now);
  const isShowingResult = battle.state === "settling" || battle.state === "settled";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.top} pointerEvents="none">
        {battle.state === "countdown" ? <BattleTimerPill secondsRemaining={battle.durationSeconds} label="BATTLE" /> : null}
        {battle.state === "active" ? <BattleTimerPill secondsRemaining={battleSeconds} label={battleSeconds <= FINAL_SECONDS ? "FINAL" : "BATTLE"} /> : null}
      </View>
      {battle.state === "countdown" ? <BigCenterNumber value={countdownSeconds > 0 ? String(countdownSeconds) : "GO!"} isSubtle={false} /> : null}
      {battle.state === "active" && battleSeconds <= FINAL_SECONDS ? <BigCenterNumber value={String(battleSeconds)} isSubtle /> : null}
      {battle.state === "settled" && !battle.isTie ? <BattleConfetti burstKey={battle.id} height={gridHeight} /> : null}
      {isShowingResult ? (
        <View style={styles.resultWrap} pointerEvents="none">
          <BattleResultBanner battle={battle} />
        </View>
      ) : null}
      {isTwoPlayer ? (
        <View style={styles.bottom} pointerEvents="none">
          <BattleTugOfWarBar left={battle.participants[0]!} right={battle.participants[1]!} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", top: 6, left: 0, right: 0, alignItems: "center", gap: 4 },
  bigNumberWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  bigNumber: { textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 8 },
  resultWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: -18 },
});
