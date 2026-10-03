import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { liveGuestsService } from "@/services/liveGuests.service";
import type { UserSummary } from "@/types";
import { MAXIMUM_STREAMERS_ON_STAGE } from "@/types/liveStage.type";

import type { LiveStageController } from "./liveStage.hook";

function SmallActionButton({ label, onPress, tone = "neutral", disabled }: { label: string; onPress: () => void; tone?: "neutral" | "primary" | "danger"; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, tone === "primary" ? styles.actionPrimary : tone === "danger" ? styles.actionDanger : null, disabled ? styles.actionDisabled : null]}
    >
      <Text size={12} weight={600} lineHeight={15} color={tone === "neutral" ? colors.text : colors.white}>
        {label}
      </Text>
    </Pressable>
  );
}

function PersonRow({ user, caption, children }: { user: UserSummary; caption?: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Avatar uri={user.avatarUrl} size={36} />
      <View style={styles.flex}>
        <Text size={14} weight={500} lineHeight={17} numberOfLines={1}>
          {user.name}
        </Text>
        <Text size={12} lineHeight={15} color={colors.textMuted} numberOfLines={1}>
          {caption ?? `@${user.username}`}
        </Text>
      </View>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text size={14} weight={600} lineHeight={17} style={styles.sectionTitle}>
      {children}
    </Text>
  );
}

export function LiveGuestsSheet({ liveId, visible, controller, onClose }: { liveId: string; visible: boolean; controller: LiveStageController; onClose: () => void }) {
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
    <BottomSheet visible={visible} onClose={onClose} title={`Guests · ${stage.streamers.length}/${MAXIMUM_STREAMERS_ON_STAGE} on stage`}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {controller.actionErrorMessage ? (
          <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="polite">
            {controller.actionErrorMessage}
          </Text>
        ) : null}
        <SectionTitle>On stage</SectionTitle>
        {stage.streamers.map((streamer) => (
          <PersonRow key={streamer.user.id} user={streamer.user} caption={streamer.role === "host" ? "Host (you)" : `${streamer.audioMuted ? "Muted" : "Mic on"} · ${streamer.videoMuted ? "Camera off" : "Camera on"}${streamer.isCreatorProgramMember ? "" : " · gifts paid to you"}`}>
            <SmallActionButton
              label={streamer.audioMuted ? "Unmute" : "Mute"}
              onPress={() => controller.setStreamerAudioMuted(streamer.user.id, !streamer.audioMuted)}
            />
            <SmallActionButton
              label={streamer.videoMuted ? "Cam on" : "Cam off"}
              onPress={() => controller.setStreamerVideoMuted(streamer.user.id, !streamer.videoMuted)}
            />
            {streamer.role === "guest" ? <SmallActionButton label="Remove" tone="danger" onPress={() => controller.removeGuestFromStage(streamer.user.id)} /> : null}
          </PersonRow>
        ))}
        {stage.joinRequests.length > 0 ? <SectionTitle>{`Requests to join (${stage.joinRequests.length})`}</SectionTitle> : null}
        {stage.joinRequests.map((request) => (
          <PersonRow key={request.id} user={request.user} caption="Wants to join you on stage">
            <SmallActionButton label="Decline" onPress={() => controller.declineJoinRequest(request.id)} />
            <SmallActionButton label="Approve" tone="primary" disabled={stage.streamers.length >= MAXIMUM_STREAMERS_ON_STAGE} onPress={() => controller.approveJoinRequest(request.id)} />
          </PersonRow>
        ))}
        <SectionTitle>Invite viewers</SectionTitle>
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
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  sectionTitle: { marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: 6 },
  action: { borderRadius: 14, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 10, paddingVertical: 5 },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionDanger: { backgroundColor: colors.error, borderColor: colors.error },
  actionDisabled: { opacity: 0.45 },
});
