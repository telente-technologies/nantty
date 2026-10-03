import { isBattleStillRunning } from "@/components/live/battle/battleStandings.util";
import type { LiveStage } from "@/types/liveStage.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

import type { LiveStageRailButton } from "./liveStageControlRail";
import type { LiveStageController } from "./liveStage.hook";

const confirmEndingBattleEarly = (stage: LiveStage, controller: LiveStageController) =>
  showAlertWithButtons("End battle now?", "Scores are final as they are right now, and the battle is settled immediately.", [
    { text: "Keep going", style: "cancel" },
    { text: "End battle", style: "destructive", onPress: () => stage.activeBattle && controller.endLiveBattleEarly(stage.activeBattle.id) },
  ]);

const confirmLeavingStage = (stage: LiveStage, controller: LiveStageController) => {
  const isInRunningBattle =
    isBattleStillRunning(stage.activeBattle) && stage.activeBattle!.participants.some((participant) => participant.userId === controller.signedInUserId);
  showAlertWithButtons(
    "Leave the stage?",
    isInRunningBattle
      ? "You're in a battle. Leaving now means you forfeit. You keep your coins unless this is a winner-takes-all battle."
      : "You'll go back to watching.",
    [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: controller.leaveStage },
    ],
  );
};

export function buildHostStageRailButtons(
  stage: LiveStage,
  controller: LiveStageController,
  actions: { openGuests: () => void; openBattleSetup: () => void; openBattleProposal: () => void },
): LiveStageRailButton[] {
  const battleButton: LiveStageRailButton = stage.battleProposal
    ? { key: "battle", glyph: "⏳", label: "Pending", onPress: actions.openBattleProposal }
    : isBattleStillRunning(stage.activeBattle)
      ? { key: "battle", glyph: "🏁", label: "End battle", onPress: () => confirmEndingBattleEarly(stage, controller) }
      : { key: "battle", glyph: "⚔️", label: "Battle", isDisabled: stage.streamers.length < 2 || stage.activeBattle !== null, onPress: actions.openBattleSetup };
  return [{ key: "guests", glyph: "👥", label: "Guests", badgeCount: stage.joinRequests.length, onPress: actions.openGuests }, battleButton];
}

export function buildAudienceStageRailButtons(stage: LiveStage, controller: LiveStageController): LiveStageRailButton[] {
  const me = stage.streamers.find((streamer) => streamer.user.id === controller.signedInUserId);
  if (stage.myRole === "guest" && me) {
    return [
      { key: "mic", glyph: me.audioMuted ? "🔇" : "🎙️", label: me.audioMuted ? "Unmute" : "Mute", onPress: () => controller.setStreamerAudioMuted("me", !me.audioMuted) },
      { key: "camera", glyph: "📷", label: me.videoMuted ? "Cam on" : "Cam off", onPress: () => controller.setStreamerVideoMuted("me", !me.videoMuted) },
      { key: "leave", glyph: "🚪", label: "Leave", onPress: () => confirmLeavingStage(stage, controller) },
    ];
  }
  const isRequestPending = stage.myJoinRequest?.state === "pending";
  return [
    {
      key: "join",
      glyph: "🙋",
      label: isRequestPending ? "Requested" : "Join",
      isDisabled: isRequestPending || controller.isActionPending,
      onPress: controller.requestToJoinStage,
    },
  ];
}
