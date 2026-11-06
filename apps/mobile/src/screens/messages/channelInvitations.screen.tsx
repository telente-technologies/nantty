import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { channelsService, type ChannelInvitation } from "@/services/social/channels.service";
import { useTheme } from "@/theme";

export function ChannelInvitationsScreen({ navigation, route }: MainScreenProps<"ChannelInvitations">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const token = route.params?.token;
  const preview = useQuery({
    queryKey: ["channel-invitation-link-preview", token],
    queryFn: () => channelsService.previewInvitationLink(token!),
    enabled: Boolean(token),
    retry: false,
  });
  const invitations = useInfiniteQuery({
    queryKey: ["channel-invitations"],
    queryFn: ({ pageParam }) => channelsService.listInvitations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const claim = useMutation({
    mutationFn: () => channelsService.claimInvitationLink(token!),
    onSuccess: async () => {
      setNotice("Invitation requested. It remains pending until you accept it below.");
      await queryClient.invalidateQueries({ queryKey: ["channel-invitations"] });
      navigation.setParams({ token: undefined });
    },
    onError: (error: Error) => setNotice(error.message || "Couldn't request this channel invitation."),
  });
  const respond = useMutation({
    mutationFn: ({ invitationId, action }: { readonly invitationId: string; readonly action: "accept" | "decline" }) =>
      action === "accept" ? channelsService.acceptInvitation(invitationId) : channelsService.declineInvitation(invitationId),
    onSuccess: async (invitation, variables) => {
      setNotice(variables.action === "accept" ? "Invitation accepted. You are now subscribed to the channel." : "Invitation declined.");
      await queryClient.invalidateQueries({ queryKey: ["channel-invitations"] });
      if (variables.action === "accept") {
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        navigation.navigate("Chat", { conversationId: invitation.channelId, name: invitation.channelTitle ?? "Channel" });
      }
    },
    onError: (error: Error) => setNotice(error.message || "Couldn't update this invitation. Please retry."),
  });
  const rows = invitations.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Screen background={colors.surface}>
      <Header title="Channel invitations" onBack={() => navigation.goBack()} />
      {token ? <View style={[styles.preview, { backgroundColor: colors.background, borderColor: colors.divider }]}>
        {preview.isPending ? <Text size={14} color={colors.textMuted}>Checking invitation link…</Text> : null}
        {preview.isError ? <Text accessibilityRole="alert" size={14} lineHeight={20} color={colors.error}>This channel invitation is unavailable or has expired. Ask the sender for a new link.</Text> : null}
        {preview.data ? <>
          <Text size={16} weight={600}>{preview.data.channel.title || "Nantty channel"}</Text>
          <Text size={13} color={colors.textMuted}>{preview.data.channel.subscriberCount} subscribers · expires {new Date(preview.data.expiresAt).toLocaleDateString()}</Text>
          <Text size={12} lineHeight={17} color={colors.textMuted}>Requesting does not subscribe you. You must explicitly accept the pending invitation before you receive channel posts.</Text>
          <Button title="Request invitation" loading={claim.isPending} disabled={claim.isPending} onPress={() => claim.mutate()} />
        </> : null}
      </View> : null}
      {notice ? <Text accessibilityLiveRegion="polite" size={13} lineHeight={18} color={colors.textMuted} style={styles.notice}>{notice}</Text> : null}
      {invitations.isPending ? <ListSkeleton rows={4} /> : invitations.isError && !invitations.data ? (
        <ErrorState error={invitations.error} message="Couldn't load channel invitations." onRetry={() => { void invitations.refetch(); }} retrying={invitations.isRefetching} />
      ) : (
        <FlatList
          data={rows.filter((invitation) => invitation.status === "pending")}
          keyExtractor={(invitation) => invitation.id}
          contentContainerStyle={styles.list}
          refreshing={invitations.isRefetching}
          onRefresh={() => { void invitations.refetch(); }}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.divider }]} />}
          renderItem={({ item }) => <ChannelInvitationRow invitation={item} busy={respond.isPending && respond.variables?.invitationId === item.id} onRespond={(action) => respond.mutate({ invitationId: item.id, action })} />}
          ListEmptyComponent={<Text size={14} lineHeight={20} color={colors.textMuted} align="center" style={styles.empty}>No pending channel invitations.</Text>}
          ListFooterComponent={invitations.hasNextPage ? <Button title="Load more" variant="subtle" loading={invitations.isFetchingNextPage} disabled={invitations.isFetchingNextPage} onPress={() => { void invitations.fetchNextPage(); }} /> : undefined}
        />
      )}
    </Screen>
  );
}

function ChannelInvitationRow({ invitation, busy, onRespond }: { readonly invitation: ChannelInvitation; readonly busy: boolean; readonly onRespond: (action: "accept" | "decline") => void }) {
  const { colors } = useTheme();
  return <View style={styles.row}>
    <View style={styles.copy}>
      <Text size={15} weight={600}>{invitation.channelTitle?.trim() || "Nantty channel"}</Text>
      <Text size={13} lineHeight={18} color={colors.textMuted}>You were invited to subscribe. Accept to join this channel, or decline to dismiss the invitation.</Text>
    </View>
    <View style={styles.actions}>
      <Button title="Decline" variant="subtle" disabled={busy} onPress={() => onRespond("decline")} />
      <Button title="Accept" loading={busy} disabled={busy} onPress={() => onRespond("accept")} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  preview: { marginHorizontal: 16, marginTop: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, gap: 9 },
  notice: { paddingHorizontal: 16, paddingTop: 12 },
  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  row: { gap: 12, paddingVertical: 14 },
  copy: { gap: 5 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  separator: { height: StyleSheet.hairlineWidth },
  empty: { paddingVertical: 32 },
});
