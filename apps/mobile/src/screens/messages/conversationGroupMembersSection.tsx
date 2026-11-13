import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { ConversationMember, UserSummary } from "@/types";

import { GroupMemberPicker } from "@/components/chat/groupMemberPicker";
import { GroupMemberRow } from "@/components/chat/groupMemberRow";
import { useTheme } from "@/theme";
import { useStyles } from "./conversationInfo.styles";

interface ConversationGroupMembersSectionProps {
  readonly members: readonly ConversationMember[];
  readonly myUserId: string;
  readonly canManageMembers: boolean;
  readonly isAddingMembers: boolean;
  readonly onToggleAddingMembers: () => void;
  readonly selectedPeople: readonly UserSummary[];
  readonly onToggleSelectedPerson: (person: UserSummary) => void;
  readonly invitationError: string | null;
  readonly isSendingInvitations: boolean;
  readonly onSendInvitations: () => void;
  readonly onPromote: (member: ConversationMember) => void;
  readonly onDemote: (member: ConversationMember) => void;
  readonly onReport: (member: ConversationMember) => void;
  readonly onRemove: (member: ConversationMember) => void;
}

export function ConversationGroupMembersSection({
  members,
  myUserId,
  canManageMembers,
  isAddingMembers,
  onToggleAddingMembers,
  selectedPeople,
  onToggleSelectedPerson,
  invitationError,
  isSendingInvitations,
  onSendInvitations,
  onPromote,
  onDemote,
  onReport,
  onRemove,
}: ConversationGroupMembersSectionProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text size={14} weight={600} lineHeight={16.8}>{members.length} members</Text>
        {canManageMembers ? (
          <Text
            size={13} weight={500} lineHeight={16.9} color={colors.primary}
            accessibilityRole="button" onPress={onToggleAddingMembers}
          >
            {isAddingMembers ? "Cancel" : "Invite people"}
          </Text>
        ) : null}
      </View>
      {isAddingMembers ? (
        <View style={styles.addMembers}>
          <GroupMemberPicker
            selectedPeople={selectedPeople}
            onToggleSelectedPerson={onToggleSelectedPerson}
            excludedUserIds={members.map((member) => member.user.id)}
            isInsideScrollView
            searchPurpose="invite"
          />
          <Text size={12} lineHeight={17} color={colors.textMuted}>
            Invitations require each person to accept. Acceptance records consent only; secure key setup is still required before they become a member or can read messages.
          </Text>
          {invitationError ? (
            <Text accessibilityRole="alert" size={12} lineHeight={17} color={colors.error}>{invitationError}</Text>
          ) : null}
          <Button
            title={`Send invitation${selectedPeople.length === 1 ? "" : "s"}${selectedPeople.length ? ` · ${selectedPeople.length}` : ""}`}
            disabled={selectedPeople.length === 0}
            loading={isSendingInvitations}
            onPress={onSendInvitations}
          />
        </View>
      ) : null}
      {members.map((member) => (
        <GroupMemberRow
          key={member.user.id}
          member={member}
          isMe={member.user.id === myUserId || member.user.id === "u_me"}
          canManageMembers={canManageMembers}
          onPromoteToAdmin={() => onPromote(member)}
          onDemoteToMember={() => onDemote(member)}
          onReport={() => onReport(member)}
          onRemoveFromGroup={() => onRemove(member)}
        />
      ))}
    </View>
  );
}
