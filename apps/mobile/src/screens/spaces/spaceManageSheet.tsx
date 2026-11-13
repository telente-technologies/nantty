import { Pressable, TextInput, View } from "react-native";
import { Coin24Icon, Share24Icon, Users24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { SpaceDetails, SpaceInviteRole } from "@/services/spaces.service";
import type { UserSummary } from "@/types";
import { useTheme } from "@/theme";
import type { useSpacesStyles } from "./spaces.styles";

type SpaceStyles = ReturnType<typeof useSpacesStyles>;

export interface SpaceManageSheetProps {
  readonly styles: SpaceStyles;
  readonly visible: boolean;
  readonly space: SpaceDetails | undefined;
  readonly host: boolean;
  readonly busy: boolean;
  readonly inviteQuery: string;
  readonly inviteRole: SpaceInviteRole;
  readonly inviteTitle: string;
  readonly invitees: readonly UserSummary[];
  readonly searching: boolean;
  readonly searchError: boolean;
  readonly onClose: () => void;
  readonly onQueryChange: (query: string) => void;
  readonly onRoleChange: (role: SpaceInviteRole) => void;
  readonly onTitleChange: (title: string) => void;
  readonly onRetrySearch: () => void;
  readonly onInvite: (person: UserSummary) => void;
  readonly onShareInvite: () => void;
  readonly onAnnounce: () => void;
  readonly onToggleDonations: () => void;
  readonly onApproveRequest: (requestId: string) => void;
  readonly onDeclineRequest: (requestId: string) => void;
  readonly onMuteSpeaker: (userId: string) => void;
  readonly onDemoteSpeaker: (userId: string) => void;
  readonly onRemoveSpeaker: (userId: string) => void;
  readonly onEnd: () => void;
}

export function SpaceManageSheet({
  styles,
  visible,
  space,
  host,
  busy,
  inviteQuery,
  inviteRole,
  inviteTitle,
  invitees,
  searching,
  searchError,
  onClose,
  onQueryChange,
  onRoleChange,
  onTitleChange,
  onRetrySearch,
  onInvite,
  onShareInvite,
  onAnnounce,
  onToggleDonations,
  onApproveRequest,
  onDeclineRequest,
  onMuteSpeaker,
  onDemoteSpeaker,
  onRemoveSpeaker,
  onEnd,
}: SpaceManageSheetProps) {
  const { colors } = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Manage Space"
      scrollable
      style={styles.manageSheet}
    >
      <View style={styles.panelBody}>
        {space && host ? (
          <>
            {space.visibility === "invite_only" ? (
              <>
                <Text weight={700}>Invite listeners</Text>
                <TextInput
                  accessibilityLabel="Search people to invite"
                  placeholder="Search by name or username"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  value={inviteQuery}
                  onChangeText={onQueryChange}
                  autoCapitalize="none"
                />
                <Text weight={600}>Invite as</Text>
                <View style={styles.manageRow} accessibilityRole="radiogroup" accessibilityLabel="Invitation role">
                  {([
                    ["listener", "Listener"],
                    ["speaker", "Speaker"],
                    ["cohost", "Co-host"],
                  ] as const).map(([role, label]) => (
                    <Pressable
                      key={role}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: inviteRole === role }}
                      onPress={() => onRoleChange(role)}
                      style={[styles.inviteRole, inviteRole === role && styles.inviteRoleSelected]}
                    >
                      <Text weight={inviteRole === role ? 700 : 500}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                {inviteRole !== "listener" ? (
                  <TextInput
                    accessibilityLabel="Optional stage title"
                    placeholder="Optional stage title"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.input}
                    value={inviteTitle}
                    onChangeText={(value) => onTitleChange(value.slice(0, 60))}
                    maxLength={60}
                  />
                ) : null}
                {searching ? <Text color={colors.textMuted}>Searching…</Text> : null}
                {searchError ? <Button title="Retry search" variant="subtle" onPress={onRetrySearch} /> : null}
                {invitees.map((person) => (
                  <View style={styles.inviteRow} key={person.id}>
                    <Avatar uri={person.avatarUrl ?? undefined} size={38} />
                    <View style={styles.cardCopy}>
                      <Text weight={600} numberOfLines={1}>{person.name}</Text>
                      <Text size={12} color={colors.textMuted} numberOfLines={1}>@{person.username}</Text>
                    </View>
                    <Button
                      title="Invite"
                      variant="outline"
                      icon={<Users24Icon size={16} color={colors.text} />}
                      disabled={busy}
                      onPress={() => onInvite(person)}
                    />
                  </View>
                ))}
                <Button
                  title="Share invite in chat"
                  variant="outline"
                  icon={<Share24Icon size={18} color={colors.text} />}
                  onPress={onShareInvite}
                />
              </>
            ) : null}
            {!space.announcementPostId && space.visibility !== "invite_only" ? (
              <Button title="Post announcement" variant="outline" disabled={busy} onPress={onAnnounce} />
            ) : null}
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: space.giftsEnabled }}
              disabled={busy}
              onPress={onToggleDonations}
              style={styles.audienceChoice}
            >
              <Coin24Icon size={19} color={space.giftsEnabled ? colors.primary : colors.textMuted} />
              <View style={styles.audienceCopy}>
                <Text weight={600}>Allow coin support</Text>
                <Text size={12} color={colors.textMuted}>Listeners can support the host with coins.</Text>
              </View>
              <Text weight={600}>{space.giftsEnabled ? "On" : "Off"}</Text>
            </Pressable>
            <Text weight={700}>Microphone requests</Text>
            {space.pendingSpeakerRequests?.length ? (
              space.pendingSpeakerRequests.map((request) => (
                <View key={request.id} style={styles.manageRow}>
                  <Text style={styles.cardCopy}>{request.user.name}</Text>
                  <Button title="Approve" variant="outline" disabled={busy} onPress={() => onApproveRequest(request.id)} />
                  <Button title="Decline" variant="subtle" disabled={busy} onPress={() => onDeclineRequest(request.id)} />
                </View>
              ))
            ) : <Text color={colors.textMuted}>No requests yet.</Text>}
            {space.speakers.map((speaker) => (
              <View key={speaker.id} style={styles.manageSpeaker}>
                <Text weight={600}>{speaker.name}</Text>
                <View style={styles.roomLinks}>
                  <Button title="Mute" variant="outline" disabled={busy} onPress={() => onMuteSpeaker(speaker.id)} />
                  <Button title="Move to listeners" variant="outline" disabled={busy} onPress={() => onDemoteSpeaker(speaker.id)} />
                  <Button title="Remove" variant="subtle" disabled={busy} onPress={() => onRemoveSpeaker(speaker.id)} />
                </View>
              </View>
            ))}
            <Button
              title={space.state === "live" ? "End Space" : "Cancel Space"}
              variant="danger"
              disabled={busy}
              onPress={onEnd}
            />
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}
