import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { ConversationMember } from "@/types";

import { PersonRow } from "./personRow";

export interface GroupMemberRowProps {
  readonly member: ConversationMember;
  readonly isMe: boolean;
  readonly canManageMembers: boolean;
  readonly onPromoteToAdmin: () => void;
  readonly onDemoteToMember: () => void;
  readonly onRemoveFromGroup: () => void;
}

const ROLE_LABELS: Record<ConversationMember["role"], string> = { owner: "Owner", admin: "Admin", member: "" };

export function GroupMemberRow({ member, isMe, canManageMembers, onPromoteToAdmin, onDemoteToMember, onRemoveFromGroup }: GroupMemberRowProps) {
  const canManageThisMember = canManageMembers && !isMe && member.role !== "owner";
  const [isShowingActions, setIsShowingActions] = useState(false);
  const roleLabel = isMe ? "You" : ROLE_LABELS[member.role];
  const runActionAndCollapse = (action: () => void) => () => {
    setIsShowingActions(false);
    action();
  };
  return (
    <View>
    <PersonRow
      person={member.user}
      avatarSize={40}
      onPress={canManageThisMember ? () => setIsShowingActions((showing) => !showing) : undefined}
      right={
        roleLabel ? (
          <Text size={12} weight={500} lineHeight={16.8} color={member.role === "member" ? colors.textMuted : colors.primary} style={styles.role}>
            {roleLabel}
          </Text>
        ) : null
      }
    />
      {isShowingActions ? (
        <View style={styles.actions}>
          <MemberActionButton
            label={member.role === "admin" ? "Remove as admin" : "Make group admin"}
            onPress={runActionAndCollapse(member.role === "admin" ? onDemoteToMember : onPromoteToAdmin)}
          />
          <MemberActionButton label="Remove from group" destructive onPress={runActionAndCollapse(onRemoveFromGroup)} />
        </View>
      ) : null}
    </View>
  );
}

function MemberActionButton({ label, destructive = false, onPress }: { label: string; destructive?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.actionButton}>
      <Text size={12} weight={500} lineHeight={16.8} color={destructive ? colors.error : colors.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  role: { marginLeft: 8 },
  actions: { flexDirection: "row", gap: 8, paddingLeft: 48, paddingTop: 6 },
  actionButton: { height: 30, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.divider, justifyContent: "center" },
});
