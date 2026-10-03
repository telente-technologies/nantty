import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Gift24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { UserSummary } from "@/types";

import { LiveViewerPointsPill } from "@/components/live/points/liveViewerPointsPill";

import { LiveGiftBanners } from "./liveGiftBanners";
import { useLiveGiftCatalog } from "./liveGiftCatalog.hook";
import { LiveGiftFlyingAnimations } from "./liveGiftFlyingAnimations";
import { LiveGiftGoalBar } from "./liveGiftGoalBar";
import { LiveGiftGoalEditorSheet } from "./liveGiftGoalEditorSheet";
import { LiveGiftHostDashboardSheet } from "./liveGiftHostDashboardSheet";
import { LiveGiftLeaderboardSheet } from "./liveGiftLeaderboardSheet";
import { useLiveGiftOverlayQueues } from "./liveGiftOverlayQueues.hook";
import { LiveGiftSpotlight } from "./liveGiftSpotlight";
import { useLiveGiftGoal } from "./liveGiftStats.hook";
import { LiveTopGiftersChip } from "./liveTopGiftersChip";

export interface LiveGiftOverlayProps {
  readonly liveId: string;
  readonly streamer: UserSummary;
  readonly isHost: boolean;
  readonly topOffset: number;
}

export function LiveGiftOverlay({ liveId, streamer, isHost, topOffset }: LiveGiftOverlayProps) {
  const { giftsById } = useLiveGiftCatalog();
  const queues = useLiveGiftOverlayQueues(liveId, streamer.id, giftsById);
  const { goal } = useLiveGiftGoal(liveId);
  const [openSheet, setOpenSheet] = useState<"leaderboard" | "hostDashboard" | "goalEditor" | null>(null);
  const closeSheet = () => setOpenSheet(null);

  return (
    <>
      <LiveGiftFlyingAnimations
        microFloats={queues.microFloats}
        mediumFlyers={queues.mediumFlyers}
        onMicroFloatDone={queues.removeMicroFloat}
        onMediumFlyerDone={queues.removeMediumFlyer}
      />
      <View pointerEvents="box-none" style={[styles.topStack, { top: topOffset }]}>
        <LiveTopGiftersChip liveId={liveId} onPress={() => setOpenSheet("leaderboard")} />
        {isHost ? null : <LiveViewerPointsPill liveId={liveId} />}
        {goal ? <LiveGiftGoalBar goal={goal} onPress={isHost ? () => setOpenSheet("goalEditor") : undefined} /> : null}
        {isHost ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Open gift dashboard" onPress={() => setOpenSheet("hostDashboard")} style={styles.hostChip}>
            <Gift24Icon size={16} color={colors.white} />
            <Text size={11} weight={600} lineHeight={14} color={colors.white}>
              {queues.sessionTotalCoins ? `${queues.sessionTotalCoins.toLocaleString("en-US")} coins received` : goal ? "Gift dashboard" : "Set a gift goal"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View pointerEvents="none" style={styles.bannerArea}>
        <LiveGiftBanners banners={queues.visibleBanners} />
      </View>
      {queues.currentSpotlight ? (
        <LiveGiftSpotlight key={queues.currentSpotlight.key} entry={queues.currentSpotlight} streamerUsername={streamer.username} onFinished={queues.finishCurrentSpotlight} />
      ) : null}
      <LiveGiftLeaderboardSheet liveId={liveId} visible={openSheet === "leaderboard"} onClose={closeSheet} />
      {isHost ? (
        <>
          <LiveGiftHostDashboardSheet
            liveId={liveId}
            visible={openSheet === "hostDashboard"}
            goal={goal}
            recentGifts={queues.recentGifts}
            onEditGoal={() => setOpenSheet("goalEditor")}
            onClose={closeSheet}
          />
          <LiveGiftGoalEditorSheet liveId={liveId} goal={goal} visible={openSheet === "goalEditor"} onClose={closeSheet} />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  topStack: { position: "absolute", left: 16, gap: 6, alignItems: "flex-start" },
  hostChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.4)" },
  bannerArea: { position: "absolute", left: 8, right: 60, bottom: 300 },
});
