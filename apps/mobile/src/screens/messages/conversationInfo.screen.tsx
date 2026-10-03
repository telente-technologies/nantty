import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { BusinessLabel } from "@/components/chat/businessLabel";
import { describeConversationForDisplay } from "@/components/chat/conversationDisplay.util";
import { DisappearingMessagesPicker } from "@/components/chat/disappearingMessagesPicker";
import { GroupMemberPicker } from "@/components/chat/groupMemberPicker";
import { GroupMemberRow } from "@/components/chat/groupMemberRow";
import { ArrowLeft24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { channelsService } from "@/services/channels.service";
import { groupsService } from "@/services/groups.service";
import { messagesService } from "@/services/messages.service";
import { useAuthStore } from "@/store/auth.store";
import type { Conversation, ConversationSettingsUpdate, UserSummary } from "@/types";

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
  const members = useQuery({
    queryKey: ["conversation-members", conversationId],
    queryFn: () => groupsService.fetchConversationMembers(conversationId),
    enabled: !!display?.isGroup,
  });

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
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => navigation.goBack()}>
          <ArrowLeft24Icon />
        </Pressable>
        <Text size={18} weight={500} lineHeight={21.6} accessibilityRole="header">
          {display?.isChannel ? "Channel info" : display?.isGroup ? "Group info" : "Chat info"}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.encryptionNotice} accessibilityRole="text">
          <Text size={12} lineHeight={17} color={colors.textMuted} align="center">
            🔒 Messages are end-to-end encrypted. Only people in this chat can read them.
          </Text>
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
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>
              {display.subtitle}
            </Text>
          ) : null}
        </View>

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

        {display?.isGroup ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text size={14} weight={600} lineHeight={16.8}>
                {(members.data ?? []).length} members
              </Text>
              {canEditGroup ? (
                <Text size={13} weight={500} lineHeight={16.9} color={colors.primary} accessibilityRole="button" onPress={() => setIsAddingMembers((adding) => !adding)}>
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
                onRemoveFromGroup={() => runMemberAction.mutate(() => groupsService.removeMemberFromGroup(conversationId, member.user.id))}
              />
            ))}
          </View>
        ) : null}

        {errorMessage ? (
          <Text size={13} lineHeight={16.9} color={colors.error}>
            {errorMessage}
          </Text>
        ) : null}

        {display && (display.isGroup || display.isChannel) ? (
          <Button
            title={display.isChannel ? (conversation.data?.myRole === "owner" ? "Leave channel" : "Unsubscribe") : "Leave group"}
            variant="danger"
            loading={leaveConversation.isPending}
            onPress={() => leaveConversation.mutate()}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  encryptionNotice: { paddingHorizontal: 24, paddingVertical: 12 },
  header: { height: 49, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 18 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  identity: { alignItems: "center", gap: 8, paddingTop: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  section: { gap: 10 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addMembers: { gap: 12 },
  nameInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: fontFamily[500],
    fontSize: 15,
    letterSpacing: calculateDefaultLetterSpacing(15),
    color: colors.text,
  },
}));
