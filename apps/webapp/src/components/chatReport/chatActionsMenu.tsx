"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { Button } from "@/components/ui/button";
import { MoreIcon } from "@/components/ui/icons";
import { ModalDialog } from "@/components/ui/modalDialog";
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
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const isGroupLike = conversation.kind === "group" || conversation.kind === "channel";
  const block = useMutation({
    mutationFn: () => chatReportsService.blockConversationPeer(conversation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push("/chats");
    },
  });

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  const startReport = (kind: ChatReportTarget["kind"], alsoBlock = false) => {
    setIsMenuOpen(false);
    requireAuthThen(
      () => onStartReport({ kind, reportedUser: kind === "group" ? null : conversation.peer, message: null, alsoBlock }),
      "Sign in to report a chat.",
    );
  };
  const items = isGroupLike
    ? [{ label: conversation.kind === "channel" ? "Report channel" : "Report group", onSelect: () => startReport("group") }]
    : [
        { label: "Report user", onSelect: () => startReport("user") },
        { label: "Report and block", onSelect: () => startReport("user", true) },
        { label: "Report conversation", onSelect: () => startReport("conversation") },
        { label: "Block", onSelect: () => { setIsMenuOpen(false); setIsBlockDialogOpen(true); } },
      ];

  return (
    <div className={`${menuStyles.container} ${styles.menuHost}`} ref={containerRef}>
      <button type="button" className={menuStyles.trigger} aria-label="Conversation options" aria-haspopup="true" aria-expanded={isMenuOpen} aria-controls={menuId} onClick={() => setIsMenuOpen((open) => !open)}>
        <MoreIcon size={20} />
      </button>
      {isMenuOpen ? (
        <div className={menuStyles.menu} id={menuId}>
          {items.map((item) => (
            <button key={item.label} type="button" className={`${menuStyles.item} ${menuStyles.itemDanger}`} onClick={item.onSelect}>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      <ModalDialog
        isOpen={isBlockDialogOpen}
        onClose={() => setIsBlockDialogOpen(false)}
        title={`Block ${conversation.peer.name}?`}
        description="They won't be able to message you. They won't be told you blocked them."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsBlockDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => block.mutate()} busy={block.isPending}>Block</Button>
          </>
        }
      >
        {block.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(block.error)}</p> : null}
      </ModalDialog>
    </div>
  );
}
