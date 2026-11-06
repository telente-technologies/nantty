import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTickingServerNow } from "@/components/live/battle/battleClock.hook";
import { BattleCoinContributionSheet } from "@/components/live/battle/battleCoinContributionSheet";
import { BattleHistoryCard } from "@/components/live/battle/battleHistoryCard";
import { BattleProposalSheet, isMyConsentPending } from "@/components/live/battle/battleProposalSheet";
import { BattleSetupSheet } from "@/components/live/battle/battleSetupSheet";
import { BattleStageOverlay } from "@/components/live/battle/battleStageOverlay";
import type { LiveSessionDetails } from "@/types";
import type { LiveStageStreamer } from "@/types/liveStage.type";

import { LiveGuestsSheet } from "./liveGuestsSheet";
import { LiveStageControlRail } from "./liveStageControlRail";
import type { LiveMedia } from "../media/liveMedia.hook";
import { LiveStageGrid } from "./liveStageGrid";
import type { LiveStageController } from "./liveStage.hook";
import { LiveStageInvitePrompt } from "./liveStageInvitePrompt";
import { buildAudienceStageRailButtons, buildHostStageRailButtons } from "./liveStageRailButtons.util";
import { stageGridHeightForWidth } from "./stageGridLayout.util";
import { requireAuthThen } from "@/utils/requireAuth.util";

const HEADER_CLEARANCE = 64;
const GRID_MAXIMUM_SCREEN_SHARE = 0.52;
const STAGE_BACKDROP_COLOR = "#14121C";

export interface LiveStageLayerProps {
  readonly liveId: string;
  readonly session: LiveSessionDetails;
  readonly controller: LiveStageController;
  readonly isCameraPermissionGranted: boolean;
  readonly isPlaybackAllowed: boolean;
  readonly media?: LiveMedia;
}

export function LiveStageLayer({ liveId, session, controller, isCameraPermissionGranted, isPlaybackAllowed, media }: LiveStageLayerProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [isGuestsSheetOpen, setIsGuestsSheetOpen] = useState(false);
  const [isBattleSetupOpen, setIsBattleSetupOpen] = useState(false);
  const [contributionRecipient, setContributionRecipient] = useState<LiveStageStreamer | null>(null);
  const [dismissedHistoryBattleId, setDismissedHistoryBattleId] = useState<string | null>(null);
  const stage = controller.stage;
  const now = useTickingServerNow(controller.serverClockOffsetMs, !!stage?.activeBattle);
  const [dismissedProposalId, setDismissedProposalId] = useState<string | null>(null);
  if (!stage) return null;

  const isHostView = stage.myRole === "host";
  const canContributeToBattle = !isHostView && stage.activeBattle?.state === "active";
  const gridTop = insets.top + HEADER_CLEARANCE;
  const gridHeight = stageGridHeightForWidth(stage.streamers.length, window.width, window.height * GRID_MAXIMUM_SCREEN_SHARE);
  const belowGridTop = controller.isMultiGuestLayout ? gridTop + gridHeight + (stage.activeBattle?.participants.length === 2 ? 28 : 10) : gridTop + 40;
  const latestBattle = stage.activeBattle ? null : stage.battleHistory[0];
  const historyBattleToShow = controller.isMultiGuestLayout && latestBattle && latestBattle.id !== dismissedHistoryBattleId ? latestBattle : null;

  const pressStreamerTile = (streamer: LiveStageStreamer) => {
    if (isHostView) return setIsGuestsSheetOpen(true);
    if (streamer.user.id !== controller.signedInUserId && canContributeToBattle) {
      requireAuthThen(() => setContributionRecipient(streamer), undefined, "contribute coins");
    }
  };

  const railButtons = isHostView
    ? buildHostStageRailButtons(stage, controller, {
        openGuests: () => setIsGuestsSheetOpen(true),
        openBattleSetup: () => setIsBattleSetupOpen(true),
        openBattleProposal: () => setDismissedProposalId(null),
      })
    : buildAudienceStageRailButtons(stage, controller);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {controller.isMultiGuestLayout ? (
        <>
          <View style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="none" />
          <View style={[styles.gridWrap, { top: gridTop }]} pointerEvents="box-none">
            <LiveStageGrid
              stage={stage}
              session={session}
              signedInUserId={controller.signedInUserId}
              maximumHeight={window.height * GRID_MAXIMUM_SCREEN_SHARE}
              isCameraPermissionGranted={isCameraPermissionGranted}
              isPlaybackAllowed={isPlaybackAllowed}
              media={media}
              tilePressHint={isHostView ? "Opens guest controls" : canContributeToBattle ? "Opens coin contribution" : ""}
              onPressStreamer={pressStreamerTile}
              onPressEmptySeat={isHostView ? () => setIsGuestsSheetOpen(true) : undefined}
              overlay={stage.activeBattle ? <BattleStageOverlay battle={stage.activeBattle} now={now} gridHeight={gridHeight} /> : null}
            />
          </View>
        </>
      ) : null}
      {historyBattleToShow ? (
        <View style={[styles.historyCard, { top: belowGridTop }]}>
          <BattleHistoryCard battle={historyBattleToShow} onDismiss={() => setDismissedHistoryBattleId(historyBattleToShow.id)} />
        </View>
      ) : null}
      <View style={[styles.rail, { top: belowGridTop }]} pointerEvents="box-none">
        <LiveStageControlRail buttons={railButtons} />
      </View>
      <BattleProposalSheet
        proposal={stage.battleProposal}
        isHostView={isHostView}
        hostName={session.host.name}
        signedInUserId={controller.signedInUserId}
        isVisible={
          stage.battleProposal !== null &&
          stage.battleProposal.id !== dismissedProposalId &&
          (isHostView || isMyConsentPending(stage.battleProposal, controller.signedInUserId))
        }
        isActionPending={controller.isActionPending}
        onAccept={controller.acceptWinnerTakesAllProposal}
        onDecline={controller.declineWinnerTakesAllProposal}
        onRunWithoutWinnerTakesAll={controller.startPendingBattleWithoutWinnerTakesAll}
        onCancel={controller.cancelPendingBattle}
        onClose={() => setDismissedProposalId(stage.battleProposal?.id ?? null)}
      />
      {isHostView ? (
        <>
          <LiveGuestsSheet liveId={liveId} visible={isGuestsSheetOpen} controller={controller} onClose={() => setIsGuestsSheetOpen(false)} />
          <BattleSetupSheet
            visible={isBattleSetupOpen}
            streamers={stage.streamers}
            isStarting={controller.isActionPending}
            errorMessage={isBattleSetupOpen ? controller.actionErrorMessage : null}
            onStartBattle={(input) => {
              controller.createLiveBattle(input);
              setIsBattleSetupOpen(false);
            }}
            onClose={() => {
              setIsBattleSetupOpen(false);
              controller.clearActionError();
            }}
          />
        </>
      ) : (
        <>
          <BattleCoinContributionSheet
            key={contributionRecipient?.user.id ?? "no-recipient"}
            recipient={contributionRecipient}
            battle={stage.activeBattle}
            onStageUpdated={controller.replaceStageSnapshot}
            onClose={() => setContributionRecipient(null)}
          />
          <LiveStageInvitePrompt
            invite={stage.invitationForMe}
            host={session.host}
            isResponding={controller.isActionPending}
            onAccept={controller.acceptStageInvitation}
            onDecline={controller.declineStageInvitation}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: STAGE_BACKDROP_COLOR },
  gridWrap: { position: "absolute", left: 0, right: 0 },
  historyCard: { position: "absolute", left: 12, right: 84 },
  rail: { position: "absolute", right: 12 },
});
