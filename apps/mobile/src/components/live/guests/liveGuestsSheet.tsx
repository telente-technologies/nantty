import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { UserPlus24Icon, Users24Icon, VideoCamera24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { liveGuestsService } from "@/services/live/liveGuests.service";
import { MAXIMUM_STREAMERS_ON_STAGE } from "@/types/liveStage.type";

import { LiveSheetActionButton as SmallActionButton, LiveSheetPersonRow as PersonRow, LiveSheetSectionTitle as SectionTitle } from "../liveSheetParts";
import type { LiveStageController } from "./liveStage.hook";

export function LiveGuestsSheet({ liveId, visible, controller, onClose }: { liveId: string; visible: boolean; controller: LiveStageController; onClose: () => void }) {
  const { colors } = useTheme();
  const [searchText, setSearchText] = useState("");
  const stage = controller.stage;
  const viewers = useQuery({
    queryKey: ["live-stage-viewers", liveId, searchText.trim()],
    queryFn: () => liveGuestsService.searchLiveViewersToInvite(liveId, searchText.trim()),
    enabled: visible,
  });
  if (!stage) return null;
  const pendingInvites = stage.invitations.filter((slot) => slot.state === "invited");
  const reservedSeats = stage.streamers.length + pendingInvites.length;
  const isStageFull = reservedSeats >= MAXIMUM_STREAMERS_ON_STAGE;
  const latestInviteStatusFor = (userId: string) => [...stage.invitations].reverse().find((slot) => slot.user.id === userId)?.state;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Guests" subtitle={`${stage.streamers.length} of ${MAXIMUM_STREAMERS_ON_STAGE} seats on stage`} scrollable>
      <View style={styles.body}>
        {controller.actionErrorMessage ? (
          <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="polite">
            {controller.actionErrorMessage}
          </Text>
        ) : null}
        <SectionTitle icon={<VideoCamera24Icon size={20} color={colors.textMuted} />}>On stage</SectionTitle>
        {stage.streamers.map((streamer) => (
          <PersonRow key={streamer.user.id} user={streamer.user} caption={streamer.role === "host" ? "Host (you)" : `${streamer.audioMuted ? "Muted" : "Mic on"} · ${streamer.videoMuted ? "Camera off" : "Camera on"}${streamer.isCreatorProgramMember ? "" : " · coin contributions paid to you"}`}>
            <SmallActionButton
              label={streamer.audioMuted ? "Unmute" : "Mute"}
              onPress={() => controller.setStreamerAudioMuted(streamer.user.id, !streamer.audioMuted)}
            />
            <SmallActionButton
              label={streamer.videoMuted ? "Cam on" : "Cam off"}
              onPress={() => controller.setStreamerVideoMuted(streamer.user.id, !streamer.videoMuted)}
            />
            {streamer.role === "guest" ? <SmallActionButton
                label="Remove"
                tone="danger"
                onPress={() =>
                  showAlertWithButtons(`Remove ${streamer.user.name} from the stage?`, "Their camera and mic stop showing right away. They go back to watching.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => controller.removeGuestFromStage(streamer.user.id) },
                  ], { intent: "removeMember" })
                }
              /> : null}
          </PersonRow>
        ))}
        {stage.joinRequests.length > 0 ? <SectionTitle icon={<UserPlus24Icon size={20} color={colors.textMuted} />}>{`Requests to join (${stage.joinRequests.length})`}</SectionTitle> : null}
        {stage.joinRequests.map((request) => (
          <PersonRow key={request.id} user={request.user} caption="Wants to join you on stage">
            <SmallActionButton label="Decline" onPress={() => controller.declineJoinRequest(request.id)} />
            <SmallActionButton label="Approve" tone="primary" disabled={stage.streamers.length >= MAXIMUM_STREAMERS_ON_STAGE} onPress={() => controller.approveJoinRequest(request.id)} />
          </PersonRow>
        ))}
        <SectionTitle icon={<Users24Icon size={20} color={colors.textMuted} />}>Invite viewers</SectionTitle>
        <TextField placeholder="Search viewers" value={searchText} onChangeText={setSearchText} autoCapitalize="none" accessibilityLabel="Search viewers" />
        {isStageFull ? (
          <Text size={12} lineHeight={16} color={colors.textMuted}>
            The stage is full. Remove a guest to invite someone else.
          </Text>
        ) : null}
        {(viewers.data ?? []).map((viewer) => {
          const inviteStatus = latestInviteStatusFor(viewer.id);
          return (
            <PersonRow
              key={viewer.id}
              user={viewer}
              caption={inviteStatus === "invited" ? "Invite sent · waiting" : inviteStatus === "declined" ? "Declined your invite" : inviteStatus === "expired" ? "Invite expired" : undefined}
            >
              <SmallActionButton
                label={inviteStatus === "invited" ? "Invited" : "Invite"}
                tone="primary"
                disabled={inviteStatus === "invited" || isStageFull}
                onPress={() => controller.inviteViewerToStage(viewer.id)}
              />
            </PersonRow>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 10 },
});
