import { useTheme } from "@/theme";
import { Pressable, View } from "react-native";
import {
  Broadcast24Icon,
  CalendarDots24Icon,
  Headset24Icon,
} from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import type { SpaceInvitation, SpaceSummary } from "@/services/spaces.service";
import { spaceInvitationRoleLabel } from "@/utils/spaceInvitation.util";
import type { useSpacesStyles } from "./spaces.styles";

type SpaceStyles = ReturnType<typeof useSpacesStyles>;

export interface SpacesDirectoryContentProps {
  readonly styles: SpaceStyles;
  readonly isSignedIn: boolean;
  readonly invitations: readonly SpaceInvitation[];
  readonly invitationsLoading: boolean;
  readonly invitationsRefetching: boolean;
  readonly invitationsError: string | null;
  readonly invitationActionError: string | null;
  readonly pendingInvitationId: string | null;
  readonly hasMoreInvitations: boolean;
  readonly loadingMoreInvitations: boolean;
  readonly onOpenInvitation: (space: SpaceSummary) => void;
  readonly onRespondToInvitation: (invitation: SpaceInvitation, accept: boolean) => void;
  readonly onRetryInvitations: () => void;
  readonly onLoadMoreInvitations: () => void;
  readonly spaces: readonly SpaceSummary[];
  readonly spacesLoading: boolean;
  readonly spacesError: unknown;
  readonly spacesRefetching: boolean;
  readonly onRetrySpaces: () => void;
  readonly onOpenSpace: (space: SpaceSummary) => void;
}

export function SpacesDirectoryContent({
  styles,
  isSignedIn,
  invitations,
  invitationsLoading,
  invitationsRefetching,
  invitationsError,
  invitationActionError,
  pendingInvitationId,
  hasMoreInvitations,
  loadingMoreInvitations,
  onOpenInvitation,
  onRespondToInvitation,
  onRetryInvitations,
  onLoadMoreInvitations,
  spaces,
  spacesLoading,
  spacesError,
  spacesRefetching,
  onRetrySpaces,
  onOpenSpace,
}: SpacesDirectoryContentProps) {
  const { colors } = useTheme();

  return (
    <>
      {isSignedIn ? (
        <View style={styles.listSection}>
          <Text size={18} weight={700}>Your invitations</Text>
          {invitationsLoading ? <Text accessibilityLiveRegion="polite">Loading invitations…</Text> : null}
          {invitationsError ? (
            <View>
              <Text accessibilityRole="alert" color={colors.error}>{invitationsError}</Text>
              <Button title="Retry invitations" variant="subtle" onPress={onRetryInvitations} loading={invitationsRefetching} />
            </View>
          ) : null}
          {invitationActionError ? <Text accessibilityRole="alert" color={colors.error}>{invitationActionError}</Text> : null}
          {!invitationsLoading && !invitationsError && invitations.length === 0 ? (
            <Text color={colors.textMuted}>No pending Space invitations.</Text>
          ) : null}
          {invitations.map((invitation) => {
            const pending = pendingInvitationId === invitation.invitationId;
            const inviter = invitation.space.host.name || (invitation.space.host.username ? `@${invitation.space.host.username}` : "A Nantty member");
            const invitationRole = spaceInvitationRoleLabel(invitation.role);
            const invitedDate = Number.isNaN(Date.parse(invitation.invitedAt))
              ? null
              : new Date(invitation.invitedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
            return (
              <View key={`${invitation.spaceId}:${invitation.invitationId}`} style={styles.invitationCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open invited Space ${invitation.space.title}`}
                  onPress={() => onOpenInvitation(invitation.space)}
                >
                  <View style={styles.cardTop}>
                    <Avatar uri={invitation.space.host.avatarUrl ?? undefined} size={42} />
                    <View style={styles.cardCopy}>
                      <Text size={13} weight={600}>Invited by {inviter}</Text>
                      <Text size={12} color={colors.textMuted}>{invitationRole}{invitation.title ? ` · ${invitation.title}` : ""}</Text>
                    </View>
                  </View>
                  <Text size={17} weight={700}>{invitation.space.title}</Text>
                  {invitation.space.description ? <Text size={13} color={colors.textMuted} numberOfLines={2}>{invitation.space.description}</Text> : null}
                  <Text size={12} color={colors.primary}>Open Space details</Text>
                  {invitedDate ? <Text size={11} color={colors.textMuted}>Invited {invitedDate}</Text> : null}
                </Pressable>
                <View style={styles.invitationActions}>
                  <Button title={pending ? "Accepting…" : "Accept"} height={40} disabled={pendingInvitationId !== null} loading={pending} onPress={() => onRespondToInvitation(invitation, true)} style={styles.invitationAction} />
                  <Button title={pending ? "Please wait" : "Decline"} variant="subtle" height={40} disabled={pendingInvitationId !== null} onPress={() => onRespondToInvitation(invitation, false)} style={styles.invitationAction} />
                </View>
              </View>
            );
          })}
          {hasMoreInvitations ? (
            <Button title="Load more invitations" variant="subtle" disabled={loadingMoreInvitations} loading={loadingMoreInvitations} onPress={onLoadMoreInvitations} />
          ) : null}
        </View>
      ) : null}
      <Text size={13} weight={600} color={colors.textMuted}>LIVE AUDIO · PUBLIC CONVERSATIONS</Text>
      {spacesLoading ? <Text>Finding Spaces…</Text> : null}
      {spacesError ? (
        <ErrorState error={spacesError} compact onRetry={onRetrySpaces} retrying={spacesRefetching} />
      ) : null}
      {!spacesLoading && !spacesError && spaces.length === 0 ? (
        <View style={styles.empty}>
          <Text size={20} weight={600}>A little quiet for now</Text>
          <Text color={colors.textMuted}>Start a conversation or check back soon.</Text>
        </View>
      ) : null}
      {(["live", "scheduled"] as const).map((state) => (
        <View key={state} style={styles.listSection}>
          <Text size={18} weight={700}>{state === "live" ? "Live now" : "Coming up"}</Text>
          {spaces.filter((item) => item.state === state).map((item) => {
            const scheduledLabel = item.scheduledAt
              ? new Date(item.scheduledAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Scheduled";
            return (
              <Pressable
                key={item.id}
                style={styles.discoveryCard}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${state === "live" ? "join live Space" : "view scheduled Space"}`}
                onPress={() => onOpenSpace(item)}
              >
                <View style={styles.cardTop}>
                  <Avatar uri={item.host.avatarUrl ?? undefined} size={42} />
                  <View style={styles.cardCopy}>
                    <Text size={13} weight={600}>{item.host.name}</Text>
                    <Text size={12} color={colors.textMuted}>{state === "live" ? `${item.listenerCount} listening` : scheduledLabel}</Text>
                  </View>
                  <View style={[styles.statePill, state === "live" && styles.livePill]}>
                    {state === "live" ? <Broadcast24Icon size={15} color={colors.error} /> : <CalendarDots24Icon size={15} color={colors.textMuted} />}
                    <Text size={11} weight={700} color={state === "live" ? colors.error : colors.textMuted}>{state === "live" ? "LIVE" : "SCHEDULED"}</Text>
                  </View>
                </View>
                <Text size={18} weight={700}>{item.title}</Text>
                {item.description ? <Text size={14} color={colors.textMuted} numberOfLines={2}>{item.description}</Text> : null}
                <View style={styles.discoveryFooter}>
                  <View style={styles.listenerCount}>
                    {state === "live" ? <Headset24Icon size={17} color={colors.textMuted} /> : <CalendarDots24Icon size={17} color={colors.textMuted} />}
                    <Text size={12} color={colors.textMuted}>{state === "live" ? `${item.listenerCount} listening` : scheduledLabel}</Text>
                  </View>
                  <View style={styles.joinIcon} accessibilityElementsHidden>
                    {state === "live" ? <Headset24Icon color={colors.onPrimary} /> : <CalendarDots24Icon color={colors.onPrimary} />}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );
}
