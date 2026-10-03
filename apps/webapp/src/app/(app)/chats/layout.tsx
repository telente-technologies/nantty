"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

import { ConversationListPanel } from "@/components/messages/conversationListPanel";

import styles from "./chatsSplit.module.css";

export default function ChatsLayout({ children }: { readonly children: ReactNode }) {
  const activeConversationId = useSelectedLayoutSegment();
  return (
    <div className={[styles.split, activeConversationId ? styles.splitWithConversation : ""].join(" ")}>
      <div className={styles.listPane}>
        <ConversationListPanel activeConversationId={activeConversationId} />
      </div>
      <div className={styles.conversationPane}>{children}</div>
    </div>
  );
}
