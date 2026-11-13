import { View } from "react-native";
import {
  ChatCircle24Icon,
  GearSix24Icon,
  Headset24Icon,
  Share24Icon,
  Users24Icon,
} from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import type { SpaceDetails, SpaceJoinGrant } from "@/services/spaces.service";
import { useTheme } from "@/theme";
import type { useSpacesStyles } from "./spaces.styles";
import type { SpaceAudioConnection } from "./useSpaceAudioConnection.hook";

type SpaceStyles = ReturnType<typeof useSpacesStyles>;

export interface SpaceRoomContentProps {
  readonly styles: SpaceStyles;
  readonly space: SpaceDetails | undefined;
  readonly loading: boolean;
  readonly error: unknown;
  readonly refetching: boolean;
  readonly host: boolean;
  readonly joined: boolean;
  readonly grant: SpaceJoinGrant | null;
  readonly audio: SpaceAudioConnection;
  readonly announcementId: string | null;
  readonly busy: boolean;
  readonly onRetry: () => void;
  readonly onManage: () => void;
  readonly onOpenAnnouncement: (postId: string) => void;
  readonly onAnnounce: () => void;
  readonly onShareInvite: () => void;
  readonly onReport: () => void;
}

export function SpaceRoomContent({
  styles,
  space,
  loading,
  error,
  refetching,
  host,
  joined,
  grant,
  audio,
  announcementId,
  busy,
  onRetry,
  onManage,
  onOpenAnnouncement,
  onAnnounce,
  onShareInvite,
  onReport,
}: SpaceRoomContentProps) {
  const { colors } = useTheme();

  return (
    <>
      {loading ? <Text accessibilityLiveRegion="polite">Opening Space…</Text> : null}
      {error ? (
        <ErrorState
          error={error}
          compact
          message="Couldn't load this Space."
          onRetry={onRetry}
          retrying={refetching}
        />
      ) : null}
      {space ? (
        <>
          <View style={styles.statusRow}>
            <Text size={12} weight={700} color={colors.primary}>
              {space.state === "live" ? "LIVE AUDIO" : space.state.toUpperCase()}
            </Text>
            {host && ["live", "scheduled"].includes(space.state) ? (
              <Button
                title="Manage"
                variant="subtle"
                icon={<GearSix24Icon size={18} color={colors.text} />}
                onPress={onManage}
              />
            ) : null}
          </View>
          <Text size={28} weight={700} lineHeight={34}>{space.title}</Text>
          {space.description ? <Text color={colors.textMuted}>{space.description}</Text> : null}
          {space.state === "scheduled" && space.scheduledAt ? (
            <View style={styles.scheduleCard}>
              <Text size={13} color={colors.textMuted}>SAVE THE DATE</Text>
              <Text size={20} weight={600}>
                {new Date(space.scheduledAt).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              <Text color={colors.primary} weight={600}>
                {new Date(space.scheduledAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })} · your local time
              </Text>
            </View>
          ) : null}
          <View style={styles.stage}>
            <View style={styles.stageHeading}>
              <Text weight={600}>On stage</Text>
              <View style={styles.listenerCount}>
                <Users24Icon size={16} color={colors.textMuted} />
                <Text size={12} color={colors.textMuted}>{space.listenerCount}</Text>
              </View>
            </View>
            <View style={styles.stageGrid}>
              <StagePerson person={space.host} styles={styles} />
              {space.speakers
                .filter((person) => person.id !== space.host.id)
                .map((person) => <StagePerson key={person.id} person={person} styles={styles} />)}
            </View>
            <Text size={12} color={colors.textMuted} style={styles.audioStatus}>
              {grant?.demo
                ? "Preview room · no live audio"
                : audio.status === "connected"
                  ? "You're connected"
                  : audio.status === "connecting" || audio.status === "reconnecting"
                    ? "Connecting to audio…"
                    : "Audio only · settle in and listen"}
            </Text>
          </View>
          {audio.error ? <Text accessibilityRole="alert" color={colors.error}>{audio.error}</Text> : null}
          {["failed", "unavailable"].includes(audio.status) ? (
            <Button
              title="Reconnect audio"
              variant="outline"
              icon={<Headset24Icon size={18} color={colors.text} />}
              onPress={audio.retry}
            />
          ) : null}
          <View style={styles.conversationCard}>
            <Text weight={600}>
              {space.visibility === "invite_only" ? "Share this invitation" : "Keep the conversation going"}
            </Text>
            <Text size={13} color={colors.textMuted}>
              {space.visibility === "invite_only"
                ? "Only invited people can preview and open this Space."
                : "Questions and replies stay together on the announcement post."}
            </Text>
            {space.announcementPostId || announcementId ? (
              <Button
                title="Open announcement and comments"
                variant="outline"
                icon={<ChatCircle24Icon size={18} color={colors.text} />}
                onPress={() => onOpenAnnouncement((space.announcementPostId || announcementId)!)}
              />
            ) : host && space.visibility !== "invite_only" ? (
              <Button
                title="Post announcement"
                variant="outline"
                icon={<ChatCircle24Icon size={18} color={colors.text} />}
                disabled={busy}
                onPress={onAnnounce}
              />
            ) : host ? (
              <Button
                title="Share invite in chat"
                variant="outline"
                icon={<Share24Icon size={18} color={colors.text} />}
                onPress={onShareInvite}
              />
            ) : (
              <Text size={12} color={colors.textMuted}>
                {space.visibility === "invite_only"
                  ? "This Space is invite only."
                  : "Look for the host’s announcement in your feed."}
              </Text>
            )}
          </View>
          {space.state === "live" && joined && !host ? (
            <View style={styles.roomLinks}>
              <Button title="Report Space" variant="subtle" onPress={onReport} />
            </View>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function StagePerson({
  person,
  styles,
}: {
  readonly person: SpaceDetails["host"];
  readonly styles: SpaceStyles;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.stagePerson}>
      <View style={[styles.avatarRing, person.role === "host" && styles.hostRing]}>
        <Avatar uri={person.avatarUrl ?? undefined} size={64} />
      </View>
      <Text size={14} weight={600} numberOfLines={1}>{person.name || "Space host"}</Text>
      <Text size={12} color={colors.textMuted}>
        {person.role === "host" ? "Host" : person.muted ? "Speaker · muted" : "Speaker"}
      </Text>
    </View>
  );
}
