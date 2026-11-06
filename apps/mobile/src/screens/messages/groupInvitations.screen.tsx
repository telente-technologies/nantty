import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { groupsService, type GroupInvitation, type GroupInvitationDirection } from "@/services/social/groups.service";
import { useTheme } from "@/theme";

export function GroupInvitationsScreen({ navigation, route }: MainScreenProps<"GroupInvitations">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<GroupInvitationDirection>("received");
  const [actionInvitationId, setActionInvitationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inviteToken = route.params?.token;
  const linkPreview = useQuery({
    queryKey: ["group-invitation-link-preview", inviteToken],
    queryFn: () => groupsService.previewGroupInvitationLink(inviteToken!),
    enabled: !!inviteToken,
    retry: false,
  });
  const invitations = useInfiniteQuery({
    queryKey: ["group-invitations", direction],
    queryFn: ({ pageParam }) => groupsService.listGroupInvitations(direction, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const respond = useMutation({
    mutationFn: async ({ invitation, action }: { readonly invitation: GroupInvitation; readonly action: "accept" | "decline" | "revoke" }) => {
      setActionInvitationId(invitation.id);
      if (action === "accept") return groupsService.acceptGroupInvitation(invitation.id);
      if (action === "decline") return groupsService.declineGroupInvitation(invitation.id);
      return groupsService.revokeGroupInvitation(invitation.conversationId, invitation.id);
    },
    onSuccess: (result, variables) => {
      if (variables.action === "accept" && result.membershipStatus === "awaiting_secure_key_handoff") {
        setNotice("Consent recorded. You have not joined the group; secure key setup is still required before membership or message access.");
      } else if (variables.action === "decline") {
        setNotice("Invitation declined.");
      } else if (variables.action === "revoke") {
        setNotice("Invitation revoked.");
      }
      return queryClient.invalidateQueries({ queryKey: ["group-invitations"] });
    },
    onError: (error: Error) => setNotice(`${error.message || "Couldn't update this invitation."} Retry using the same action.`),
    onSettled: () => setActionInvitationId(null),
  });
  const claimLink = useMutation({
    mutationFn: () => groupsService.claimGroupInvitationLink(inviteToken!),
    onSuccess: async () => {
      setDirection("received");
      setNotice("Invitation requested. Review and accept it below; acceptance is consent only, and secure key setup is still required before you become a member or read messages.");
      await queryClient.invalidateQueries({ queryKey: ["group-invitations"] });
      navigation.setParams({ token: undefined });
    },
    onError: (error: Error) => setNotice(error.message || "Couldn't request to join this group."),
  });
  const entries = invitations.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Screen background={colors.surface}>
      <Header title="Group invitations" onBack={() => navigation.goBack()} />
      {inviteToken ? (
        <View style={[styles.linkCard, { backgroundColor: colors.background, borderColor: colors.divider }]}>
          {linkPreview.isPending ? <Text size={14} color={colors.textMuted}>Checking invitation link…</Text> : null}
          {linkPreview.isError ? <Text accessibilityRole="alert" size={14} lineHeight={20} color={colors.error}>This invitation link is unavailable or has expired. Ask the sender for a new link.</Text> : null}
          {linkPreview.data ? (
            <>
              <Text size={16} weight={600} lineHeight={20}>{linkPreview.data.group.title || "Nantty group"}</Text>
              <Text size={13} lineHeight={18} color={colors.textMuted}>{linkPreview.data.group.memberCount} members · invitation expires {new Date(linkPreview.data.expiresAt).toLocaleDateString()}</Text>
              <Text size={12} lineHeight={17} color={colors.textMuted}>Requesting creates a pending invitation only. You must accept it, and secure key setup is still required before you become a member or read messages.</Text>
              <Button title={claimLink.isPending ? "Requesting…" : "Request invitation"} loading={claimLink.isPending} disabled={claimLink.isPending} onPress={() => claimLink.mutate()} />
            </>
          ) : null}
        </View>
      ) : null}
      <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel="Invitation direction">
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: direction === "received" }} onPress={() => { setDirection("received"); setNotice(null); }} style={[styles.tab, { backgroundColor: direction === "received" ? colors.chip : colors.surface }]}>
          <Text size={13} weight={500} color={direction === "received" ? colors.text : colors.textMuted}>Received</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: direction === "sent" }} onPress={() => { setDirection("sent"); setNotice(null); }} style={[styles.tab, { backgroundColor: direction === "sent" ? colors.chip : colors.surface }]}>
          <Text size={13} weight={500} color={direction === "sent" ? colors.text : colors.textMuted}>Sent</Text>
        </Pressable>
      </View>
      {notice ? <Text accessibilityLiveRegion="polite" accessibilityRole={respond.isError ? "alert" : "text"} size={13} lineHeight={18} color={respond.isError ? colors.error : colors.textMuted} style={styles.notice}>{notice}</Text> : null}
      {invitations.isPending ? (
        <ListSkeleton rows={4} />
      ) : invitations.isError && !invitations.data ? (
        <ErrorState error={invitations.error} message="Couldn't load group invitations." onRetry={() => invitations.refetch()} retrying={invitations.isRefetching} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(invitation) => invitation.id}
          contentContainerStyle={[styles.list, entries.length === 0 && styles.emptyList]}
          refreshing={invitations.isRefetching}
          onRefresh={() => { void invitations.refetch(); }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <InvitationCard
              invitation={item}
              direction={direction}
              busy={actionInvitationId === item.id}
              disabled={actionInvitationId !== null}
              onAction={(action) => { setNotice(null); respond.mutate({ invitation: item, action }); }}
            />
          )}
          ListEmptyComponent={(
            <Text size={14} lineHeight={20} color={colors.textMuted} align="center" style={styles.empty}>
              {direction === "received" ? "No pending group invitations." : "You haven't sent any pending invitations."}
            </Text>
          )}
          ListFooterComponent={invitations.hasNextPage ? (
            <Button title="Load more" variant="subtle" loading={invitations.isFetchingNextPage} disabled={invitations.isFetchingNextPage} onPress={() => { void invitations.fetchNextPage(); }} />
          ) : undefined}
        />
      )}
    </Screen>
  );
}

function InvitationCard({ invitation, direction, busy, disabled, onAction }: {
  readonly invitation: GroupInvitation;
  readonly direction: GroupInvitationDirection;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onAction: (action: "accept" | "decline" | "revoke") => void;
}) {
  const { colors } = useTheme();
  const counterpart = invitation.counterpart;
  const identity = counterpart?.name || (counterpart?.username ? `@${counterpart.username}` : "A Nantty member");
  const isPending = invitation.status === "pending";
  const acceptedAwaitingKey = invitation.status === "accepted" && invitation.membershipStatus === "awaiting_secure_key_handoff";
  const createdAt = new Date(invitation.createdAt);
  const dateLabel = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.divider }]}>
      <View style={styles.identity}>
        <Avatar uri={counterpart?.avatarUrl ?? null} size={44} />
        <View style={styles.identityText}>
          <Text size={15} weight={600} lineHeight={19} numberOfLines={1}>
            {direction === "received" ? `${identity} invited you` : `Invitation to ${identity}`}
          </Text>
          {counterpart?.username ? <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>@{counterpart.username}</Text> : null}
          {dateLabel ? <Text size={12} lineHeight={16} color={colors.textMuted}>{dateLabel}</Text> : null}
        </View>
      </View>
      <Text size={13} lineHeight={18} color={colors.textMuted}>
        {acceptedAwaitingKey
          ? "Consent recorded; not a member yet. Secure key setup is required before you can join or read group messages."
          : isPending
            ? "This is an invitation to a group conversation. Accepting records consent only; membership begins after secure key setup."
            : `Invitation ${invitation.status}. You are not a member of this group.`}
      </Text>
      {isPending ? (
        <View style={styles.actions}>
          {direction === "received" ? (
            <>
              <Button title={busy ? "Accepting…" : "Accept invitation"} height={40} loading={busy} disabled={disabled} onPress={() => onAction("accept")} style={styles.action} />
              <Button title="Decline" variant="subtle" height={40} disabled={disabled} onPress={() => onAction("decline")} style={styles.action} />
            </>
          ) : (
            <Button title={busy ? "Revoking…" : "Revoke invitation"} variant="outline" height={40} loading={busy} disabled={disabled} onPress={() => onAction("revoke")} style={styles.action} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8 },
  notice: { marginHorizontal: 16, marginBottom: 10 },
  linkCard: { marginHorizontal: 16, marginBottom: 8, padding: 14, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  empty: { paddingHorizontal: 28, paddingVertical: 48 },
  separator: { height: 10 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 12 },
  identity: { flexDirection: "row", alignItems: "center", gap: 11 },
  identityText: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1 },
});
