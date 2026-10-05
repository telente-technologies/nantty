import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { BusinessLabel } from "@/components/chat/businessLabel";
import { describeConversationForDisplay } from "@/components/chat/conversationDisplay.util";
import { DisappearingMessagesPicker } from "@/components/chat/disappearingMessagesPicker";
import { SecurityCodeRow } from "@/components/chatSafety/securityCode";
import { useChatReportLauncher } from "@/components/chatReport/chatReportLauncher.hook";
import { GroupMemberPicker } from "@/components/chat/groupMemberPicker";
import { GroupMemberRow } from "@/components/chat/groupMemberRow";
import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import { ArrowLeft24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily, typeScale } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { channelsService } from "@/services/channels.service";
import { groupsService } from "@/services/groups.service";
import { messagesService } from "@/services/messages.service";
import { useAuthStore } from "@/store/auth.store";
import type { Conversation, ConversationSettingsUpdate, UserSummary } from "@/types";
import { LockSimple24Icon } from "@/components/icons";
import { IconRow } from "@/components/ui/iconRow";
import { spacing } from "@/constants/spacing.constant";

export function ConversationInfoScreen({ navigation, route }: MainScreenProps<"ConversationInfo">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { conversationId } = route.params;
  const queryClient = useQueryClient();
  const myUserId = useAuthStore((s) => s.user?.id ?? "u_me");
  const [renamedTitle, setRenamedTitle] = useState<string | null>(null);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [peopleToAdd, setPeopleToAdd] = useState<readonly UserSummary[]>([]);

  const conversation = useQuery({ queryKey: ["conversation", conversationId], queryFn: () => messagesService.fetchConversationById(conversationId) });
  const display = conversation.data ? describeConversationForDisplay(conversation.data) : null;
  const report = useChatReportLauncher(conversation.data);
  const members = useQuery({
    queryKey: ["conversation-members", conversationId],
    queryFn: () => groupsService.fetchConversationMembers(conversationId),
    enabled: !!display?.isGroup,
  });

  const refreshControl = usePullToRefresh(conversation.refetch, () => (display?.isGroup ? members.refetch() : undefined));
  const refreshConversationEverywhere = () => {
    queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversation-members", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const updateSettings = useMutation({
    mutationFn: (update: ConversationSettingsUpdate) => messagesService.updateConversationSettings(conversationId, update),
    onSuccess: (updated: Conversation) => {
      queryClient.setQueryData(["conversation", conversationId], updated);
      setRenamedTitle(null);
      refreshConversationEverywhere();
    },
  });
  const runMemberAction = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: refreshConversationEverywhere,
  });
  const leaveConversation = useMutation({
    mutationFn: () => (display?.isChannel ? channelsService.unsubscribeFromChannel(conversationId) : groupsService.leaveConversation(conversationId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigation.navigate("Tabs", { screen: "Chats" });
    },
  });

  const addSelectedPeople = () => {
    const userIds = peopleToAdd.map((person) => person.id);
    runMemberAction.mutate(() => groupsService.addMembersToGroup(conversationId, userIds));
    setPeopleToAdd([]);
    setIsAddingMembers(false);
  };

  const togglePersonToAdd = (person: UserSummary) =>
    setPeopleToAdd((current) =>
      current.some((selected) => selected.id === person.id) ? current.filter((selected) => selected.id !== person.id) : [...current, person],
    );

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
        <ErrorState message="Couldn't load chat info." onRetry={() => conversation.refetch()} retrying={conversation.isRefetching} />
      ) : conversation.isPending ? (
        <ListSkeleton rows={5} />
      ) : (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
        <View style={styles.encryptionNotice} accessibilityRole="text">
          <IconRow icon={<LockSimple24Icon size={14} color={colors.textMuted} />} justify="center" gap={6}>
            <Text size={typeScale.xs} lineHeight={17} color={colors.textMuted} align="center" style={{ flexShrink: 1 }}>
              Messages are end-to-end encrypted. Only people in this chat can read them.
            </Text>
          </IconRow>
        </View>
        <View style={styles.identity}>
          <Avatar uri={display?.avatarUrl ?? null} size={72} placeholderColor={colors.placeholder} />
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

        {display?.isGroup ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text size={typeScale.md} weight={600} lineHeight={16.8}>
                {(members.data ?? []).length} members
              </Text>
              {canEditGroup ? (
                <Text size={typeScale.sm} weight={500} lineHeight={16.9} color={colors.primary} accessibilityRole="button" onPress={() => setIsAddingMembers((adding) => !adding)}>
                  {isAddingMembers ? "Cancel" : "Add members"}
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
                />
                <Button title={`Add ${peopleToAdd.length || ""}`.trim()} disabled={peopleToAdd.length === 0} onPress={addSelectedPeople} />
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
                  ])
                }
              />
            ))}
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
              ]);
            }}
          />
        ) : null}
        {display && (display.isGroup || display.isChannel) ? (
          <Button title={display.isChannel ? "Report channel" : "Report group"} variant="outline" onPress={report.reportGroup} />
        ) : null}
      </ScrollView>
      )}
      {report.reportSheet}
    </Screen>
  );
}

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
