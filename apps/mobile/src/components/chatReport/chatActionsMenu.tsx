import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Flag24Icon, Info24Icon, Prohibit24Icon, UserCircle24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { ActionSheetOptionList } from "@/components/ui/actionSheet";
import { groupsService } from "@/services/social/groups.service";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Conversation, UserSummary } from "@/types";

import { ChatBlockDialog } from "./chatBlockDialog";
import { useChatReportLauncher } from "./chatReportLauncher.hook";

const MENU_TO_FOLLOW_UP_DELAY_MS = 350;

export interface ChatActionsMenuProps {
  readonly visible: boolean;
  readonly conversation: Conversation | undefined;
  readonly isGroupLike: boolean;
  readonly onClose: () => void;
  readonly onOpenConversationInfo: () => void;
  readonly onBlocked: () => void;
  readonly report: ReturnType<typeof useChatReportLauncher>;
}

export function ChatActionsMenu({ visible, conversation, isGroupLike, onClose, onOpenConversationInfo, onBlocked, report }: ChatActionsMenuProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const myUserId = useAuthStore((state) => state.user?.id ?? "u_me");
  const [isPickingMember, setIsPickingMember] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const isGroup = conversation?.kind === "group";
  const members = useQuery({
    queryKey: ["conversation-members", conversation?.id],
    queryFn: () => groupsService.fetchConversationMembers(conversation!.id),
    enabled: visible && isGroup && isPickingMember,
  });

  const closeThen = (followUp: () => void) => () => {
    setIsPickingMember(false);
    onClose();
    setTimeout(followUp, MENU_TO_FOLLOW_UP_DELAY_MS);
  };
  const reportMember = (member: UserSummary) => closeThen(() => report.reportMember(member))();
  const rows = isGroupLike
    ? [
        { label: "Conversation info", onPress: closeThen(onOpenConversationInfo), icon: <Info24Icon size={20} color={colors.textMuted} /> },
        { label: isGroup ? "Report group" : "Report channel", onPress: closeThen(report.reportGroup), isDestructive: true, icon: <Flag24Icon size={20} color={colors.error} /> },
        ...(isGroup ? [{ label: "Report a member", onPress: () => setIsPickingMember(true), isDestructive: true, icon: <UserCircle24Icon size={20} color={colors.error} /> }] : []),
      ]
    : [
        { label: "Conversation info", onPress: closeThen(onOpenConversationInfo), icon: <Info24Icon size={20} color={colors.textMuted} /> },
        { label: "Report user", onPress: closeThen(() => report.reportUser(false)), isDestructive: true, icon: <Flag24Icon size={20} color={colors.error} /> },
        { label: "Report and block", onPress: closeThen(() => report.reportUser(true)), isDestructive: true, icon: <Flag24Icon size={20} color={colors.error} /> },
        { label: "Report conversation", onPress: closeThen(report.reportConversation), isDestructive: true, icon: <Flag24Icon size={20} color={colors.error} /> },
        { label: "Block", onPress: closeThen(() => setIsBlockDialogOpen(true)), isDestructive: true, icon: <Prohibit24Icon size={20} color={colors.error} /> },
      ];
  const reportableMembers = (members.data ?? []).filter((member) => member.user.id !== myUserId && member.user.id !== "u_me");

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={() => {
          setIsPickingMember(false);
          onClose();
        }}
        title={isPickingMember ? "Report a member" : "Chat options"}
        floating
      >
        <View style={styles.list}>
          <ActionSheetOptionList
            options={
              isPickingMember
                ? reportableMembers.map((member) => ({ label: member.user.name, detail: `@${member.user.username}`, icon: <UserCircle24Icon size={20} color={colors.textMuted} />, onPress: () => reportMember(member.user) }))
                : rows.map((row) => ({ label: row.label, icon: row.icon, onPress: row.onPress, destructive: row.isDestructive }))
            }
          />
        </View>
      </BottomSheet>
      {conversation ? (
        <ChatBlockDialog visible={isBlockDialogOpen} conversation={conversation} onClose={() => setIsBlockDialogOpen(false)} onBlocked={onBlocked} />
      ) : null}
    </>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 16 },
}));
