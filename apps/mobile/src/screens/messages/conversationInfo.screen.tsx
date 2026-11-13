import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Share, TextInput, View } from "react-native";

import { describeConversationForDisplay } from "@/components/chat/conversationDisplay.util";
import { DisappearingMessagesPicker } from "@/components/chat/disappearingMessagesPicker";
import { useChatReportLauncher } from "@/components/chatReport/chatReportLauncher.hook";
import { pickPhotosAndVideosFromLibrary } from "@/components/create/pickMedia.util";
import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import { ArrowLeft24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { useTheme } from "@/theme";
import { typeScale } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { channelsService, type ChannelInvitationLink } from "@/services/social/channels.service";
import { groupsService } from "@/services/social/groups.service";
import { messagesService } from "@/services/chat/messages.service";
import { useAuthStore } from "@/store/auth.store";
import type { Conversation, ConversationSettingsUpdate, UserSummary } from "@/types";
import { webAppLinks } from "@/config/webAppLinks.config";
import type { GroupInvitationLink } from "@/services/social/groups.service";
import { DEFAULT_INVITATION_LINK_EXPIRY_HOURS, invitationLinkExpiryLabel, invitationLinkExpiryOptions, type InvitationLinkExpiryHours } from "@/utils/invitationLink.util";
import { ConversationGroupMembersSection } from "./conversationGroupMembersSection";
import { ConversationIdentitySection } from "./conversationIdentitySection";
import { ConversationInvitationLinksSection } from "./conversationInvitationLinksSection";
import { useStyles } from "./conversationInfo.styles";

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
  const [inviteLinkExpiryHours, setInviteLinkExpiryHours] = useState<InvitationLinkExpiryHours>(DEFAULT_INVITATION_LINK_EXPIRY_HOURS);
  const chooseInviteLinkExpiry = () => showAlertWithButtons(
    "Invitation link expiry",
    "Choose how long the link can be used to request an invitation.",
    [
      ...invitationLinkExpiryOptions.map((option) => ({ text: option.label, onPress: () => setInviteLinkExpiryHours(option.hours) })),
      { text: "Cancel", style: "cancel" as const },
    ],
  );

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
    mutationFn: () => groupsService.createGroupInvitationLink(conversationId, inviteLinkExpiryHours),
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
    mutationFn: () => channelsService.createInvitationLink(conversationId, inviteLinkExpiryHours),
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
        {display && conversation.data ? (
          <ConversationIdentitySection
            conversation={conversation.data}
            display={display}
            photoChangePending={changeGroupPhoto.isPending}
            photoChangeError={changeGroupPhoto.error}
            onChangeGroupPhoto={openGroupPhotoOptions}
          />
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
            <Button title={`Link expiry · ${invitationLinkExpiryLabel(inviteLinkExpiryHours)}`} variant="subtle" onPress={chooseInviteLinkExpiry} />
            <Button title="Create and share invite link" variant="outline" loading={createChannelInviteLink.isPending} disabled={createChannelInviteLink.isPending || revokeChannelInviteLink.isPending} onPress={() => createChannelInviteLink.mutate()} />
            {createdChannelInviteLink ? <>
              <Button title="Share link again" variant="subtle" disabled={revokeChannelInviteLink.isPending} onPress={() => { void shareChannelInviteLink(createdChannelInviteLink).catch(() => setInvitationError("The share sheet could not be opened. Try again.")); }} />
              <Button title={revokeChannelInviteLink.isPending && revokeChannelInviteLink.variables === createdChannelInviteLink.id ? "Revoking…" : "Revoke this link"} variant="subtle" loading={revokeChannelInviteLink.isPending && revokeChannelInviteLink.variables === createdChannelInviteLink.id} disabled={revokeChannelInviteLink.isPending} onPress={() => revokeChannelInviteLink.mutate(createdChannelInviteLink.id)} />
            </> : null}
            {channelInvitationLinks.isPending ? <Text size={12} color={colors.textMuted}>Loading invitation links…</Text> : null}
            {channelInvitationLinks.isError ? <Button title="Retry loading links" variant="subtle" onPress={() => { void channelInvitationLinks.refetch(); }} /> : null}
            <ConversationInvitationLinksSection
              title="Active channel invitation links"
              links={channelInvitationLinks.data?.pages.flatMap((page) => page.data) ?? []}
              isPending={channelInvitationLinks.isPending}
              isError={channelInvitationLinks.isError}
              hasNextPage={!!channelInvitationLinks.hasNextPage}
              isFetchingNextPage={channelInvitationLinks.isFetchingNextPage}
              isRevoking={revokeChannelInviteLink.isPending}
              revokingLinkId={revokeChannelInviteLink.variables}
              onRetry={() => { void channelInvitationLinks.refetch(); }}
              onLoadMore={() => { void channelInvitationLinks.fetchNextPage(); }}
              onRevoke={(linkId) => revokeChannelInviteLink.mutate(linkId)}
            />
          </View>
        ) : null}

        {display?.isGroup ? (
          <>
            <ConversationGroupMembersSection
              members={members.data ?? []}
              myUserId={myUserId}
              canManageMembers={canEditGroup}
              isAddingMembers={isAddingMembers}
              onToggleAddingMembers={() => setIsAddingMembers((adding) => !adding)}
              selectedPeople={peopleToAdd}
              onToggleSelectedPerson={togglePersonToAdd}
              invitationError={invitationError}
              isSendingInvitations={inviteSelectedPeople.isPending}
              onSendInvitations={addSelectedPeople}
              onPromote={(member) => runMemberAction.mutate(() => groupsService.promoteMemberToAdmin(conversationId, member.user.id))}
              onDemote={(member) => runMemberAction.mutate(() => groupsService.demoteAdminToMember(conversationId, member.user.id))}
              onReport={(member) => report.reportMember(member.user)}
              onRemove={(member) => showAlertWithButtons(`Remove ${member.user.name}?`, "They'll stop getting messages from this group.", [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => runMemberAction.mutate(() => groupsService.removeMemberFromGroup(conversationId, member.user.id)) },
              ], { intent: "removeMember" })}
            />
            {isAddingMembers ? (
              <View style={styles.section}>
                <Text size={12} lineHeight={17} color={colors.textMuted}>
                  Or create a shareable invitation link. Anyone with it must request an invite and explicitly accept; secure key setup remains required before joining.
                </Text>
                <Button title={`Link expiry · ${invitationLinkExpiryLabel(inviteLinkExpiryHours)}`} variant="subtle" onPress={chooseInviteLinkExpiry} />
                <Button title={createInviteLink.isPending ? "Creating link…" : "Create and share link"} variant="outline" loading={createInviteLink.isPending} disabled={createInviteLink.isPending || revokeInviteLink.isPending} onPress={() => createInviteLink.mutate()} />
                {createdInviteLink ? (
                  <>
                    <Button title="Share link again" variant="subtle" disabled={revokeInviteLink.isPending} onPress={() => { void shareGroupInviteLink(createdInviteLink).catch(() => setInvitationError("The share sheet could not be opened. Try again.")); }} />
                    <Button title={revokeInviteLink.isPending ? "Revoking…" : "Revoke this link"} variant="subtle" loading={revokeInviteLink.isPending} disabled={revokeInviteLink.isPending} onPress={() => revokeInviteLink.mutate(createdInviteLink.id)} />
                  </>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {display?.isGroup && display.isAdmin ? (
          <View style={styles.section}>
            <ConversationInvitationLinksSection
              title="Invitation links"
              links={invitationLinks.data?.pages.flatMap((page) => page.data) ?? []}
              isPending={invitationLinks.isPending}
              isError={invitationLinks.isError}
              hasNextPage={!!invitationLinks.hasNextPage}
              isFetchingNextPage={invitationLinks.isFetchingNextPage}
              isRevoking={revokeInviteLink.isPending}
              revokingLinkId={revokeInviteLink.variables}
              onRetry={() => { void invitationLinks.refetch(); }}
              onLoadMore={() => { void invitationLinks.fetchNextPage(); }}
              onRevoke={(linkId) => revokeInviteLink.mutate(linkId)}
            />
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
