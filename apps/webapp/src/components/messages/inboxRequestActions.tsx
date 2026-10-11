"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ChatReportDialog } from "@/components/chatReport/chatReportDialog";
import type { ChatReportTarget } from "@/components/chatReport/chatReportTarget.type";
import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";
import type { Conversation } from "@/types";

import styles from "./conversationListPanel.module.css";

interface InboxRequestActionsProps {
  readonly conversation: Conversation;
  readonly viewerId: string;
  readonly showExplanation?: boolean;
  readonly onRemoved?: () => void;
}

export function InboxRequestActions({ conversation, viewerId, showExplanation = false, onRemoved }: InboxRequestActionsProps) {
  const queryClient = useQueryClient();
  const [reportTarget, setReportTarget] = useState<ChatReportTarget | null>(null);
  const isSpam = conversation.inboxFolder === "spam";
  const refreshInbox = () => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };
  const onFailure = (error: unknown) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
  const accept = useMutation({ mutationFn: () => messagesService.acceptMessageRequest(conversation.id), onSuccess: refreshInbox, onError: onFailure });
  const notSpam = useMutation({ mutationFn: () => messagesService.markConversationNotSpam(conversation.id), onSuccess: refreshInbox, onError: onFailure });
  const remove = useMutation({
    mutationFn: () => messagesService.deleteMessageRequest(conversation.id),
    onSuccess: () => {
      refreshInbox();
      onRemoved?.();
    },
    onError: onFailure,
  });
  const block = useMutation({
    mutationFn: () => messagesService.blockConversationPeer(conversation.id),
    onSuccess: () => {
      refreshInbox();
      void queryClient.invalidateQueries({ queryKey: ["users", "me", "blocked"] });
      onRemoved?.();
    },
  });
  const isBusy = accept.isPending || notSpam.isPending || remove.isPending || block.isPending;
  const confirmBlock = () =>
    void requestConfirmation({
      title: `Block ${conversation.peer.name}?`,
      description: "They won't be able to message you. You can unblock them in chat settings.",
      confirmLabel: "Block",
      intent: "block",
      onConfirm: () => block.mutateAsync(),
      describeError: readErrorMessageForDisplay,
    });
  const startUserReport = (alsoBlock: boolean) =>
    setReportTarget({ kind: "user", conversationId: conversation.id, reportedUser: conversation.peer, message: null, alsoBlock });

  return (
    <div className={styles.requestActions}>
      {showExplanation ? (
        <p className={styles.requestExplanation}>
          {isSpam ? (conversation.spamReason ?? "Flagged by Zudomart based on this account's activity.") : "They won't see that you've read this until you accept."}
        </p>
      ) : null}
      <div className={styles.requestButtons}>
        {isSpam ? (
          <Button size="sm" disabled={isBusy} busy={notSpam.isPending} onClick={() => notSpam.mutate()}>Not spam</Button>
        ) : (
          <Button size="sm" disabled={isBusy} busy={accept.isPending} onClick={() => accept.mutate()}>Accept</Button>
        )}
        <Button size="sm" variant="secondary" disabled={isBusy} busy={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
        <Button size="sm" variant="danger" disabled={isBusy} onClick={confirmBlock}>Block</Button>
      </div>
      <div className={styles.requestButtons}>
        <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => startUserReport(false)}>Report</Button>
        <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => startUserReport(true)}>Report and block</Button>
      </div>
      <ChatReportDialog target={reportTarget} messages={[]} viewerId={viewerId} onClose={() => setReportTarget(null)} />
    </div>
  );
}
