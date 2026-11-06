import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Share, StyleSheet, TextInput, View } from "react-native";

import { BusinessLabel } from "@/components/chat/businessLabel";
import { describeConversationForDisplay } from "@/components/chat/conversationDisplay.util";
import { DisappearingMessagesPicker } from "@/components/chat/disappearingMessagesPicker";
import { SecurityCodeRow } from "@/components/chatSafety/securityCode";
import { useChatReportLauncher } from "@/components/chatReport/chatReportLauncher.hook";
import { GroupMemberPicker } from "@/components/chat/groupMemberPicker";
import { GroupMemberRow } from "@/components/chat/groupMemberRow";
import { pickPhotosAndVideosFromLibrary } from "@/components/create/pickMedia.util";
import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import { ArrowLeft24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily, typeScale } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { channelsService, type ChannelInvitationLink } from "@/services/social/channels.service";
import { groupsService } from "@/services/social/groups.service";
import { messagesService } from "@/services/chat/messages.service";
import { useAuthStore } from "@/store/auth.store";
import type { Conversation, ConversationSettingsUpdate, UserSummary } from "@/types";
import { LockSimple24Icon } from "@/components/icons";
import { IconRow } from "@/components/ui/iconRow";
import { spacing } from "@/constants/spacing.constant";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import { webAppLinks } from "@/config/webAppLinks.config";
import type { GroupInvitationLink, GroupInvitationLinkRecord } from "@/services/social/groups.service";

export function ConversationInfoScreen({ navigation, route }: MainScreenProps<"ConversationInfo">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { conversationId } = route.params;
  const queryClient = useQueryClient();
  const myUserId = useAuthStore((s) => s.user?.id ?? "u_me");
  const [renamedTitle, setRenamedTitle] = useState<string | null>(null);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [peopleToAdd, setPeopleToAdd] = useState<readonly UserSummary[]>([]);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [createdInviteLink, setCreatedInviteLink] = useState<GroupInvitationLink | null>(null);
  const [createdChannelInviteLink, setCreatedChannelInviteLink] = useState<ChannelInvitationLink | null>(null);

  const conversation = useQuery({ queryKey: ["conversation", conversationId], queryFn: () => messagesService.fetchConversationById(conversationId) });
  const display = conversation.data ? describeConversationForDisplay(conversation.data) : null;
  const report = useChatReportLauncher(conversation.data);
  const members = useQuery({
    queryKey: ["conversation-members", conversationId],
    queryFn: () => groupsService.fetchConversationMembers(conversationId),
    enabled: !!display?.isGroup,
  });
  const invitationLinks = useInfiniteQuery({
    queryKey: ["group-invitation-links", conversationId],
    queryFn: ({ pageParam }) => groupsService.listGroupInvitationLinks(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: display?.isGroup === true && display.isAdmin,
    retry: false,
  });
  const channelInvitationLinks = useInfiniteQuery({
    queryKey: ["channel-invitation-links", conversationId],
    queryFn: ({ pageParam }) => channelsService.listInvitationLinks(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: display?.isChannel === true && display.isAdmin,
    retry: false,
  });

  const refreshControl = usePullToRefresh(conversation.refetch, () => (display?.isGroup ? members.refetch() : undefined));
  const refreshConversationEverywhere = () => {
    queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversation-members", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const updateSettings = useMutation({
    mutationFn: (update: ConversationSettingsUpdate) =>
      display?.isGroup && update.name !== undefined && conversation.data
        ? groupsService.renameGroup(conversation.data, update.name)
        : messagesService.updateConversationSettings(conversationId, update),
    onSuccess: (updated: Conversation) => {
      queryClient.setQueryData(["conversation", conversationId], updated);
      setRenamedTitle(null);
      refreshConversationEverywhere();
    },
  });
  const changeGroupPhoto = useMutation({
    mutationFn: async (remove: boolean) => {
      if (!conversation.data) throw new Error("Conversation not loaded.");
      if (remove) return groupsService.changeGroupPhoto(conversation.data, null);
      const [picked] = await pickPhotosAndVideosFromLibrary(1);
      return picked && picked.mediaType === "image" ? groupsService.changeGroupPhoto(conversation.data, picked) : conversation.data;
    },
    onSuccess: (updated: Conversation) => {
      queryClient.setQueryData(["conversation", conversationId], updated);
      refreshConversationEverywhere();
    },
  });
  const openGroupPhotoOptions = () =>
    showAlertWithButtons("Group photo", "The photo is end-to-end encrypted. Only members can see it.", [
      { text: "Choose photo", onPress: () => changeGroupPhoto.mutate(false) },
      ...(conversation.data?.photoMediaId ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => changeGroupPhoto.mutate(true) }] : []),
      { text: "Cancel", style: "cancel" as const },
    ], { intent: "camera" });
  const runMemberAction = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: refreshConversationEverywhere,
  });
  const inviteSelectedPeople = useMutation({
    mutationFn: async (people: readonly UserSummary[]) => {
      const outcomes = await Promise.allSettled(people.map((person) => groupsService.createGroupInvitation(conversationId, person.id)));
      return {
        sentCount: outcomes.filter((outcome) => outcome.status === "fulfilled").length,
        failedIds: outcomes.flatMap((outcome, index) => outcome.status === "rejected" ? [people[index]!.id] : []),
      };
    },
    onSuccess: async ({ sentCount, failedIds }, submittedPeople) => {
      const failedPeople = submittedPeople.filter((person) => failedIds.includes(person.id));
      setPeopleToAdd(failedPeople);
      setInvitationError(failedIds.length > 0 ? `${sentCount} invitation${sentCount === 1 ? "" : "s"} sent; ${failedIds.length} couldn't be sent. Retry the remaining people.` : null);
      if (failedIds.length === 0) setIsAddingMembers(false);
      await queryClient.invalidateQueries({ queryKey: ["group-invitations"] });
    },
  });
  const createInviteLink = useMutation({
    mutationFn: () => groupsService.createGroupInvitationLink(conversationId),
    onSuccess: async (link) => {
      setCreatedInviteLink(link);
      await queryClient.invalidateQueries({ queryKey: ["group-invitation-links", conversationId] });
      try {
        await shareGroupInviteLink(link);
      } catch {
        setInvitationError("The link was created, but the share sheet could not be opened. You can try sharing it again.");
      }
    },
    onError: (error: Error) => setInvitationError(error.message || "Couldn't create a group invitation link."),
  });
  const revokeInviteLink = useMutation({
    mutationFn: (linkId: string) => groupsService.revokeGroupInvitationLink(conversationId, linkId),
    onSuccess: (_result, linkId) => {
      if (createdInviteLink?.id === linkId) setCreatedInviteLink(null);
      setInvitationError("Invitation link revoked.");
      void queryClient.invalidateQueries({ queryKey: ["group-invitation-links", conversationId] });
    },
    onError: (error: Error) => setInvitationError(error.message || "Couldn't revoke the group invitation link."),
  });
  const createChannelInviteLink = useMutation({
    mutationFn: () => channelsService.createInvitationLink(conversationId),
    onSuccess: async (link) => {
      setCreatedChannelInviteLink(link);
      try {
        await shareChannelInviteLink(link);
        setInvitationError(null);
      } catch {
        setInvitationError("The link was created, but the share sheet could not be opened. Use Share link again before leaving this screen.");
      }
      await queryClient.invalidateQueries({ queryKey: ["channel-invitation-links", conversationId] });
    },
    onError: (error: Error) => setInvitationError(error.message || "Couldn't create a channel invitation link."),
  });
  const revokeChannelInviteLink = useMutation({
    mutationFn: (linkId: string) => channelsService.revokeInvitationLink(conversationId, linkId),
    onSuccess: () => {
      setCreatedChannelInviteLink(null);
      setInvitationError("Invitation link revoked.");
      void queryClient.invalidateQueries({ queryKey: ["channel-invitation-links", conversationId] });
    },
    onError: (error: Error) => setInvitationError(error.message || "Couldn't revoke the channel invitation link."),
  });
  const leaveConversation = useMutation({
    mutationFn: () => (display?.isChannel ? channelsService.unsubscribeFromChannel(conversationId) : groupsService.leaveConversation(conversationId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigation.navigate("Tabs", { screen: "Chats" });
    },
  });

  const addSelectedPeople = () => {
    if (peopleToAdd.length === 0 || inviteSelectedPeople.isPending) return;
    setInvitationError(null);
    inviteSelectedPeople.mutate(peopleToAdd);
  };

  const togglePersonToAdd = (person: UserSummary) =>
    setPeopleToAdd((current) =>
      current.some((selected) => selected.id === person.id) ? current.filter((selected) => selected.id !== person.id) : [...current, person],
    );

  const shareGroupInviteLink = async (link: GroupInvitationLink) => {
    const url = webAppLinks.groupInvitation(link.token);
    await Share.share({ message: `You're invited to join ${display?.displayName ?? "a Nantty group"}: ${url}`, url });
  };
  const shareChannelInviteLink = async (link: ChannelInvitationLink) => {
    const url = webAppLinks.channelInvitation(link.token);
    await Share.share({ message: `You're invited to follow ${display?.displayName ?? "a Nantty channel"}: ${url}`, url });
  };

  const canEditGroup = !!(display?.isGroup || display?.isChannel) && !!display?.isAdmin;
  const canChangeDisappearing = !!display && !display.isChannel && (!display.isGroup || display.isAdmin);
  const errorMessage = (updateSettings.error ?? runMemberAction.error ?? leaveConversation.error)?.message ?? null;

  return (
    <Screen background={colors.surface}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} onPress={() => navigation.goBack()}>
          <ArrowLeft24Icon />
        </Pressable>
        <Text size={18} weight={500} lineHeight={21.6} accessibilityRole="header">
          {display?.isChannel ? "Channel info" : display?.isGroup ? "Group info" : "Chat info"}
        </Text>
      </View>
      {conversation.isError && !conversation.data ? (
        <ErrorState error={conversation.error} message="Couldn't load chat info." onRetry={() => conversation.refetch()} retrying={conversation.isRefetching} />
      ) : conversation.isPending ? (
        <ListSkeleton rows={5} />
      ) : (
      <KeyboardAwareForm contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <View style={styles.encryptionNotice} accessibilityRole="text">
          <IconRow icon={<LockSimple24Icon size={14} color={colors.textMuted} />} justify="center" gap={6}>
            <Text size={typeScale.xs} lineHeight={17} color={colors.textMuted} align="center" style={{ flexShrink: 1 }}>
              Messages are end-to-end encrypted. Only people in this chat can read them.
            </Text>
          </IconRow>
        </View>
        <View style={styles.identity}>
          {display?.isGroup && display.isAdmin && conversation.data?.hasGroupKey ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Change group photo" disabled={changeGroupPhoto.isPending} onPress={openGroupPhotoOptions}>
              <Avatar uri={display.avatarUrl ?? null} size={72} placeholderColor={colors.placeholder} />
            </Pressable>
          ) : (
            <Avatar uri={display?.avatarUrl ?? null} size={72} placeholderColor={colors.placeholder} />
          )}
          {changeGroupPhoto.error ? (
            <Text size={typeScale.sm} lineHeight={16.9} color={colors.error}>
              {describeActionFailure(changeGroupPhoto.error)}
            </Text>
          ) : null}
          <View style={styles.nameRow}>
            <Text size={18} weight={600} lineHeight={21.6} align="center">
              {display?.displayName ?? ""}
            </Text>
            {display?.isBusiness ? <BusinessLabel /> : null}
          </View>
          {display?.subtitle ? (
            <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>
              {display.subtitle}
            </Text>
          ) : null}
        </View>

        {display && !display.isGroup && !display.isChannel && conversation.data ? (
          <View style={styles.section}>
            <SecurityCodeRow peerId={conversation.data.peer.id} />
          </View>
        ) : null}

        {canEditGroup ? (
          <View style={styles.section}>
            <TextInput
              value={renamedTitle ?? display?.displayName ?? ""}
              onChangeText={setRenamedTitle}
              maxLength={60}
              accessibilityLabel={display?.isChannel ? "Channel name" : "Group name"}
              selectionColor={colors.primary}
              style={styles.nameInput}
            />
            {renamedTitle !== null && renamedTitle.trim() && renamedTitle.trim() !== display?.displayName ? (
              <Button title="Save name" height={36} loading={updateSettings.isPending} onPress={() => updateSettings.mutate({ name: renamedTitle.trim() })} />
            ) : null}
          </View>
        ) : null}

        {canChangeDisappearing ? (
          <View style={styles.section}>
            <DisappearingMessagesPicker
              selectedSeconds={conversation.data?.disappearingMessagesSeconds ?? null}
              disabled={updateSettings.isPending}
              onSelectSeconds={(seconds) => updateSettings.mutate({ disappearingMessagesSeconds: seconds })}
            />
          </View>
        ) : null}

        {display?.isGroup && display.isAdmin ? (
          <View style={styles.section}>
            <ConsentToggleRow
              label="Only admins can @all"
              description="When on, only admins can notify every member with @all."
              enabled={conversation.data?.onlyAdminsCanMentionAll === true}
              onChange={(enabled) => updateSettings.mutate({ onlyAdminsCanMentionAll: enabled })}
            />
          </View>
        ) : null}

        {display?.isChannel && display.isAdmin ? (
          <View style={styles.section}>
            <Text size={typeScale.md} weight={600} lineHeight={18}>Channel invitation links</Text>
            <Text size={12} lineHeight={17} color={colors.textMuted}>People who open a link must request an invitation and explicitly accept it before they subscribe. Existing one-tap channel subscribe remains available.</Text>
            <Button title="Create and share invite link" variant="outline" loading={createChannelInviteLink.isPending} disabled={createChannelInviteLink.isPending || revokeChannelInviteLink.isPending} onPress={() => createChannelInviteLink.mutate()} />
            {createdChannelInviteLink ? <>
              <Button title="Share link again" variant="subtle" disabled={revokeChannelInviteLink.isPending} onPress={() => { void shareChannelInviteLink(createdChannelInviteLink).catch(() => setInvitationError("The share sheet could not be opened. Try again.")); }} />
              <Button title={revokeChannelInviteLink.isPending && revokeChannelInviteLink.variables === createdChannelInviteLink.id ? "Revoking…" : "Revoke this link"} variant="subtle" loading={revokeChannelInviteLink.isPending && revokeChannelInviteLink.variables === createdChannelInviteLink.id} disabled={revokeChannelInviteLink.isPending} onPress={() => revokeChannelInviteLink.mutate(createdChannelInviteLink.id)} />
            </> : null}
            {channelInvitationLinks.isPending ? <Text size={12} color={colors.textMuted}>Loading invitation links…</Text> : null}
            {channelInvitationLinks.isError ? <Button title="Retry loading links" variant="subtle" onPress={() => { void channelInvitationLinks.refetch(); }} /> : null}
            {(channelInvitationLinks.data?.pages.flatMap((page) => page.data) ?? []).map((link) => (
              <InvitationLinkRow key={link.id} link={link} busy={revokeChannelInviteLink.isPending && revokeChannelInviteLink.variables === link.id} onRevoke={() => revokeChannelInviteLink.mutate(link.id)} />
            ))}
            {channelInvitationLinks.hasNextPage ? <Button title="Load more links" variant="subtle" loading={channelInvitationLinks.isFetchingNextPage} disabled={channelInvitationLinks.isFetchingNextPage} onPress={() => { void channelInvitationLinks.fetchNextPage(); }} /> : null}
          </View>
        ) : null}

        {display?.isGroup ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text size={typeScale.md} weight={600} lineHeight={16.8}>
                {(members.data ?? []).length} members
              </Text>
                {canEditGroup ? (
                <Text size={typeScale.sm} weight={500} lineHeight={16.9} color={colors.primary} accessibilityRole="button" onPress={() => setIsAddingMembers((adding) => !adding)}>
                  {isAddingMembers ? "Cancel" : "Invite people"}
                </Text>
              ) : null}
            </View>
            {isAddingMembers ? (
              <View style={styles.addMembers}>
                <GroupMemberPicker
                  selectedPeople={peopleToAdd}
                  onToggleSelectedPerson={togglePersonToAdd}
                  excludedUserIds={(members.data ?? []).map((member) => member.user.id)}
                  isInsideScrollView
                  searchPurpose="invite"
                />
                <Text size={12} lineHeight={17} color={colors.textMuted}>
                  Invitations require each person to accept. Acceptance records consent only; secure key setup is still required before they become a member or can read messages.
                </Text>
                {invitationError ? <Text accessibilityRole="alert" size={12} lineHeight={17} color={colors.error}>{invitationError}</Text> : null}
                <Button title={`Send invitation${peopleToAdd.length === 1 ? "" : "s"}${peopleToAdd.length ? ` · ${peopleToAdd.length}` : ""}`} disabled={peopleToAdd.length === 0} loading={inviteSelectedPeople.isPending} onPress={addSelectedPeople} />
                <Text size={12} lineHeight={17} color={colors.textMuted}>
                  Or create a shareable invitation link. Anyone with it must request an invite and explicitly accept; secure key setup remains required before joining.
                </Text>
                <Button title={createInviteLink.isPending ? "Creating link…" : "Create and share link"} variant="outline" loading={createInviteLink.isPending} disabled={createInviteLink.isPending || revokeInviteLink.isPending} onPress={() => createInviteLink.mutate()} />
                {createdInviteLink ? (
                  <>
                    <Button title="Share link again" variant="subtle" disabled={revokeInviteLink.isPending} onPress={() => { void shareGroupInviteLink(createdInviteLink).catch(() => setInvitationError("The share sheet could not be opened. Try again.")); }} />
                    <Button title={revokeInviteLink.isPending ? "Revoking…" : "Revoke this link"} variant="subtle" loading={revokeInviteLink.isPending} disabled={revokeInviteLink.isPending} onPress={() => revokeInviteLink.mutate(createdInviteLink.id)} />
                  </>
                ) : null}
              </View>
            ) : null}
            {(members.data ?? []).map((member) => (
              <GroupMemberRow
                key={member.user.id}
                member={member}
                isMe={member.user.id === myUserId || member.user.id === "u_me"}
                canManageMembers={canEditGroup}
                onPromoteToAdmin={() => runMemberAction.mutate(() => groupsService.promoteMemberToAdmin(conversationId, member.user.id))}
                onDemoteToMember={() => runMemberAction.mutate(() => groupsService.demoteAdminToMember(conversationId, member.user.id))}
                onReport={() => report.reportMember(member.user)}
                onRemoveFromGroup={() =>
                  showAlertWithButtons(`Remove ${member.user.name}?`, "They'll stop getting messages from this group.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => runMemberAction.mutate(() => groupsService.removeMemberFromGroup(conversationId, member.user.id)) },
                  ], { intent: "removeMember" })
                }
              />
            ))}
          </View>
        ) : null}

        {display?.isGroup && display.isAdmin ? (
          <View style={styles.section}>
            <Text size={typeScale.md} weight={600} lineHeight={18}>Invitation links</Text>
            {invitationLinks.isPending ? <Text size={12} color={colors.textMuted}>Loading invitation links…</Text> : null}
            {invitationLinks.isError ? (
              <Button title="Retry loading links" variant="subtle" onPress={() => { void invitationLinks.refetch(); }} />
            ) : null}
            {(invitationLinks.data?.pages.flatMap((page) => page.data) ?? []).map((link) => (
              <InvitationLinkRow
                key={link.id}
                link={link}
                busy={revokeInviteLink.isPending && revokeInviteLink.variables === link.id}
                onRevoke={() => revokeInviteLink.mutate(link.id)}
              />
            ))}
            {invitationLinks.hasNextPage ? (
              <Button title="Load more links" variant="subtle" loading={invitationLinks.isFetchingNextPage} disabled={invitationLinks.isFetchingNextPage} onPress={() => { void invitationLinks.fetchNextPage(); }} />
            ) : null}
          </View>
        ) : null}

        {errorMessage ? (
          <Text size={typeScale.sm} lineHeight={16.9} color={colors.error}>
            {errorMessage}
          </Text>
        ) : null}

        {display && (display.isGroup || display.isChannel) ? (
          <Button
            title={display.isChannel ? (conversation.data?.myRole === "owner" ? "Leave channel" : "Unsubscribe") : "Leave group"}
            variant="danger"
            loading={leaveConversation.isPending}
            onPress={() => {
              const leaveLabel = display.isChannel ? (conversation.data?.myRole === "owner" ? "Leave channel" : "Unsubscribe") : "Leave group";
              showAlertWithButtons(`${leaveLabel}?`, display.isChannel ? "You'll stop getting new posts from this channel." : "You'll stop getting messages from this group. Someone will need to add you back.", [
                { text: "Cancel", style: "cancel" },
                { text: leaveLabel, style: "destructive", onPress: () => leaveConversation.mutate() },
              ], { intent: "leave" });
            }}
          />
        ) : null}
        {display && (display.isGroup || display.isChannel) ? (
          <Button title={display.isChannel ? "Report channel" : "Report group"} variant="outline" onPress={report.reportGroup} />
        ) : null}
      </KeyboardAwareForm>
      )}
      {report.reportSheet}
    </Screen>
  );
}

function InvitationLinkRow({ link, busy, onRevoke }: { readonly link: Pick<GroupInvitationLinkRecord, "id" | "expiresAt" | "revokedAt">; readonly busy: boolean; readonly onRevoke: () => void }) {
  const { colors } = useTheme();
  const status = link.revokedAt ? "Revoked ·" : "Invitation link · expires";
  return (
    <View style={[linkStyles.row, { backgroundColor: colors.background, borderColor: colors.divider }]}>
      <View style={linkStyles.meta}>
        <Text size={13} weight={600}>{status}</Text>
        <Text size={11} lineHeight={15} color={colors.textMuted}>
          {status} {new Date(link.expiresAt).toLocaleDateString()}
        </Text>
      </View>
      {!link.revokedAt ? <Button title={busy ? "Revoking…" : "Revoke"} variant="subtle" height={36} loading={busy} disabled={busy} onPress={onRevoke} /> : null}
    </View>
  );
}

const linkStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10 },
  meta: { flex: 1, gap: 2 },
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  encryptionNotice: { paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  header: { height: 49, paddingHorizontal: spacing[4], flexDirection: "row", alignItems: "center", gap: spacing[5] },
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[8], gap: spacing[6] },
  identity: { alignItems: "center", gap: spacing[2], paddingTop: spacing[2] },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  section: { gap: 10 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addMembers: { gap: spacing[3] },
  nameInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingHorizontal: spacing[3],
    fontFamily: fontFamily[500],
    fontSize: 15,
    letterSpacing: calculateDefaultLetterSpacing(15),
    color: colors.text,
  },
}));
