import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ConversationMember } from "@/types";

import { PersonRow } from "./personRow";

export interface GroupMemberRowProps {
  readonly member: ConversationMember;
  readonly isMe: boolean;
  readonly canManageMembers: boolean;
  readonly onPromoteToAdmin: () => void;
  readonly onDemoteToMember: () => void;
  readonly onRemoveFromGroup: () => void;
  readonly onReport?: () => void;
}

const ROLE_LABELS: Record<ConversationMember["role"], string> = { owner: "Owner", admin: "Admin", member: "" };

export function GroupMemberRow({ member, isMe, canManageMembers, onPromoteToAdmin, onDemoteToMember, onRemoveFromGroup, onReport }: GroupMemberRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const canManageThisMember = canManageMembers && !isMe && member.role !== "owner";
  const hasAnyAction = canManageThisMember || (!!onReport && !isMe);
  const [isShowingActions, setIsShowingActions] = useState(false);
  const roleLabel = isMe && member.role !== "member" ? `You · ${ROLE_LABELS[member.role]}` : isMe ? "You" : ROLE_LABELS[member.role];
  const runActionAndCollapse = (action: () => void) => () => {
    setIsShowingActions(false);
    action();
  };
  return (
    <View>
      <PersonRow
        person={member.user}
        avatarSize={40}
        onPress={hasAnyAction ? () => setIsShowingActions((showing) => !showing) : undefined}
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
          {canManageThisMember ? (
            <>
              <MemberActionButton
                label={member.role === "admin" ? "Remove as admin" : "Make group admin"}
                onPress={runActionAndCollapse(member.role === "admin" ? onDemoteToMember : onPromoteToAdmin)}
              />
              <MemberActionButton label="Remove from group" destructive onPress={runActionAndCollapse(onRemoveFromGroup)} />
            </>
          ) : null}
          {onReport ? <MemberActionButton label="Report member" destructive onPress={runActionAndCollapse(onReport)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function MemberActionButton({ label, destructive = false, onPress }: { label: string; destructive?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.actionButton}>
      <Text size={12} weight={500} lineHeight={16.8} color={destructive ? colors.error : colors.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  role: { marginLeft: 8 },
  actions: { flexDirection: "row", gap: 8, paddingLeft: 48, paddingTop: 6 },
  actionButton: { height: 30, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.divider, justifyContent: "center" },
}));
