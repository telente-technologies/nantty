"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { FlagIcon, MoreIcon, ProhibitIcon } from "@/components/ui/icons";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { usePopoverMenu } from "@/components/ui/popoverMenu.hook";
import sheetStyles from "@/components/ui/popoverMenu.module.css";
import { chatReportsService } from "@/services/chatReports.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import type { Conversation } from "@/types";

import type { ChatReportTarget } from "./chatReportTarget.type";
import menuStyles from "@/components/actions/contentActionsMenu.module.css";
import styles from "./chatReport.module.css";

interface ChatActionsMenuProps {
  readonly conversation: Conversation;
  readonly onStartReport: (target: Omit<ChatReportTarget, "conversationId">) => void;
}

export function ChatActionsMenu({ conversation, onStartReport }: ChatActionsMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isOpen: menuIsOpen, close: menuClose, containerRef: menuContainerRef, triggerRef: menuTriggerRef, menuRef: menuMenuRef, triggerProps: menuTriggerProps, menuProps: menuMenuProps } = usePopoverMenu();
  const isGroupLike = conversation.kind === "group" || conversation.kind === "channel";
  const block = useMutation({
    mutationFn: () => chatReportsService.blockConversationPeer(conversation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push("/chats");
    },
  });

  const confirmBlock = () =>
    void requestConfirmation({
      title: `Block ${conversation.peer.name}?`,
      description: "They won't be able to message you. You can unblock them in chat settings. They won't be told you blocked them.",
      confirmLabel: "Block",
      intent: "block",
      onConfirm: () => block.mutateAsync(),
      describeError: readErrorMessageForDisplay,
    });
  const startReport = (kind: ChatReportTarget["kind"], alsoBlock = false) => {
    menuClose(true);
    requireAuthThen(
      () => onStartReport({ kind, reportedUser: kind === "group" ? null : conversation.peer, message: null, alsoBlock }),
      "Sign in to report a chat.",
    );
  };
  const items = isGroupLike
    ? [{ label: conversation.kind === "channel" ? "Report channel" : "Report group", icon: <FlagIcon size={18} aria-hidden="true" />, onSelect: () => startReport("group") }]
    : [
        { label: "Report user", icon: <FlagIcon size={18} aria-hidden="true" />, onSelect: () => startReport("user") },
        { label: "Report and block", icon: <FlagIcon size={18} aria-hidden="true" />, onSelect: () => startReport("user", true) },
        { label: "Report conversation", icon: <FlagIcon size={18} aria-hidden="true" />, onSelect: () => startReport("conversation") },
        { label: "Block", icon: <ProhibitIcon size={18} aria-hidden="true" />, onSelect: () => { menuClose(true); confirmBlock(); } },
      ];

  return (
    <div className={`${menuStyles.container} ${styles.menuHost}`} ref={menuContainerRef}>
      <button type="button" className={menuStyles.trigger} aria-label="Conversation options" ref={menuTriggerRef} {...menuTriggerProps}>
        <MoreIcon size={20} />
      </button>
      {menuIsOpen ? <div className={sheetStyles.scrim} aria-hidden="true" onPointerDown={() => menuClose()} /> : null}
      {menuIsOpen ? (
        <div className={`${menuStyles.menu} ${sheetStyles.sheet}`} aria-label="Conversation options" ref={menuMenuRef} {...menuMenuProps}>
          {items.map((item) => (
            <button key={item.label} type="button" role="menuitem" className={`${menuStyles.item} ${menuStyles.itemDanger}`} onClick={item.onSelect}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
