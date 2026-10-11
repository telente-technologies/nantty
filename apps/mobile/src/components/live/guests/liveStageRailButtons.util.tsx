import { isBattleStillRunning } from "@/components/live/battle/battleStandings.util";
import type { LiveStage } from "@/types/liveStage.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

import type { LiveStageRailButton } from "./liveStageControlRail";
import type { LiveStageController } from "./liveStage.hook";
import { Camera24Icon, Flag24Icon, Hand24Icon, Hourglass24Icon, Microphone24Icon, MicrophoneSlash24Icon, SignOut24Icon, Swords24Icon, Users24Icon, VideoCamera24Icon } from "@/components/icons";
import { liveGlass } from "../liveSurface.constant";

const RAIL_INK = liveGlass.ink;

const confirmEndingBattleEarly = (stage: LiveStage, controller: LiveStageController) =>
  showAlertWithButtons("End battle now?", "Scores are final as they are right now, and the battle is settled immediately.", [
    { text: "Keep going", style: "cancel" },
    { text: "End battle", style: "destructive", onPress: () => stage.activeBattle && controller.endLiveBattleEarly(stage.activeBattle.id) },
  ], { intent: "battle" });

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
    { intent: "stop" },
  );
};

export function buildHostStageRailButtons(
  stage: LiveStage,
  controller: LiveStageController,
  actions: { openGuests: () => void; openBattleSetup: () => void; openBattleProposal: () => void },
): LiveStageRailButton[] {
  const battleButton: LiveStageRailButton = stage.battleProposal
    ? { key: "battle", glyph: <Hourglass24Icon size={20} color={RAIL_INK} />, label: "Pending", onPress: actions.openBattleProposal }
    : isBattleStillRunning(stage.activeBattle)
      ? { key: "battle", glyph: <Flag24Icon size={20} color={RAIL_INK} />, label: "End battle", onPress: () => confirmEndingBattleEarly(stage, controller) }
      : { key: "battle", glyph: <Swords24Icon size={20} color={RAIL_INK} />, label: "Battle", isDisabled: stage.streamers.length < 2 || stage.activeBattle !== null, onPress: actions.openBattleSetup };
  return [{ key: "guests", glyph: <Users24Icon size={20} color={RAIL_INK} />, label: "Guests", badgeCount: stage.joinRequests.length, onPress: actions.openGuests }, battleButton];
}

export function buildAudienceStageRailButtons(stage: LiveStage, controller: LiveStageController): LiveStageRailButton[] {
  const me = stage.streamers.find((streamer) => streamer.user.id === controller.signedInUserId);
  if (stage.myRole === "guest" && me) {
    return [
      { key: "mic", glyph: me.audioMuted ? <MicrophoneSlash24Icon size={20} color={RAIL_INK} /> : <Microphone24Icon size={20} color={RAIL_INK} />, label: me.audioMuted ? "Unmute" : "Mute", onPress: () => controller.setStreamerAudioMuted("me", !me.audioMuted) },
      { key: "camera", glyph: me.videoMuted ? <Camera24Icon size={20} color={RAIL_INK} /> : <VideoCamera24Icon size={20} color={RAIL_INK} />, label: me.videoMuted ? "Cam on" : "Cam off", onPress: () => controller.setStreamerVideoMuted("me", !me.videoMuted) },
      { key: "leave", glyph: <SignOut24Icon size={20} color={RAIL_INK} />, label: "Leave", onPress: () => confirmLeavingStage(stage, controller) },
    ];
  }
  const isRequestPending = stage.myJoinRequest?.state === "pending";
  return [
    {
      key: "join",
      glyph: <Hand24Icon size={20} color={RAIL_INK} />,
      label: isRequestPending ? "Requested" : "Join",
      isDisabled: isRequestPending || controller.isActionPending,
      onPress: controller.requestToJoinStage,
    },
  ];
}
