"use client";

import { MentionText } from "@/components/mentions/mentionText";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { ChatActionsMenu } from "@/components/chatReport/chatActionsMenu";
import { ChatReportDialog } from "@/components/chatReport/chatReportDialog";
import type { ChatReportTarget } from "@/components/chatReport/chatReportTarget.type";
import reportStyles from "@/components/chatReport/chatReport.module.css";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { Avatar } from "@/components/ui/media";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { ErrorState } from "@/components/ui/feedback";
import { ChatMessagesSkeleton } from "@/components/ui/pageSkeletons";
import { RetryButton } from "@/components/ui/controls";
import { useSession } from "@/components/providers/sessionProvider";
import { DecryptionNotice, EncryptedLinkPreviewCard, SecurityCodeChangedBanner } from "@/components/messages/secureChatNotices";
import { readChatCryptoErrorMessage } from "@/services/chatCrypto/chatCrypto.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types";

import styles from "./page.module.css";

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationPage({ params }: { readonly params: Promise<{ readonly conversationId: string }> }) {
  const { conversationId } = use(params);
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [reportTarget, setReportTarget] = useState<ChatReportTarget | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const conversationQuery = useQuery({
    queryKey: ["conversations", "detail", conversationId],
    queryFn: () => messagesService.fetchConversationById(conversationId),
    retry: false,
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) => messagesService.fetchDecryptedMessagesInConversation(conversationId, viewer?.id ?? "", { cursor: pageParam }),
    enabled: Boolean(viewer?.id),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 5_000,
  });

  const readMutation = useMutation({
    mutationFn: () => messagesService.markConversationAsRead(conversationId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });

  useEffect(() => {
    readMutation.mutate();
  }, [conversationId]);

  const messages = useMemo(() => {
    const seen = new Map<string, Message>();
    for (const page of messagesQuery.data?.pages ?? []) {
      for (const message of page.data) seen.set(message.id, message);
    }
    return [...seen.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [messagesQuery.data]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const isNearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 180;
    if (isNearBottom) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (text: string) => {
      if (!conversationQuery.data || !viewer?.id) throw new Error("This conversation is still loading.");
      return messagesService.sendChatMessage(conversationQuery.data, viewer.id, text);
    },
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      bottomRef.current?.scrollIntoView({ block: "end" });
    },
  });

  function sendDraft() {
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendDraft();
  }

  const peer = conversationQuery.data?.peer;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/chats" className={styles.back} aria-label="Back to chats">
          <ArrowLeftIcon size={20} />
        </Link>
        {peer ? (
          <>
            <Avatar name={peer.name} src={conversationQuery.data?.photoUrl ?? peer.avatarUrl} size="sm" />
            <div className={styles.headerText}>
              <span className={styles.headerName}>{conversationQuery.data?.title ?? peer.name}</span>
              <span className={styles.headerHandle}>@{peer.username}</span>
            </div>
          </>
        ) : (
          <span className={styles.headerName}>Conversation</span>
        )}
        {conversationQuery.data ? (
          <ChatActionsMenu conversation={conversationQuery.data} onStartReport={(target) => setReportTarget({ ...target, conversationId })} />
        ) : null}
      </header>

      {conversationQuery.data && viewer?.id ? (
        <SecurityCodeChangedBanner
          viewerId={viewer.id}
          peerIds={(conversationQuery.data.kind ?? "direct") === "group" ? [] : [conversationQuery.data.peer.id]}
          peerName={conversationQuery.data.peer.name}
        />
      ) : null}
      <div className={styles.messages} ref={listRef}>
        {messagesQuery.isLoading ? (
          <ChatMessagesSkeleton label="Loading messages" />
        ) : messagesQuery.isError ? (
          <ErrorState description="We couldn't load this conversation." action={<RetryButton onRetry={() => messagesQuery.refetch()} />} />
        ) : messages.length === 0 ? (
          <p className={styles.empty}>Say hello — messages you send appear here.</p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === viewer?.id;
            return (
              <div key={message.id} className={[styles.bubbleRow, mine ? styles.bubbleRowMine : ""].filter(Boolean).join(" ")}>
                <div className={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs].join(" ")}>
                  {message.text ? <p className={styles.bubbleText}><MentionText text={message.text} inverseLinks={mine} /></p> : null}
                  {message.decryptionNotice ? <DecryptionNotice text={message.decryptionNotice} /> : null}
                  {message.linkPreview ? <EncryptedLinkPreviewCard preview={message.linkPreview} /> : null}
                  {message.media?.url ? (
                    message.media.type === "image" ? (
                      <img src={message.media.url} alt="Photo" className={styles.bubbleImage} loading="lazy" />
                    ) : (
                      <video src={message.media.url} controls className={styles.bubbleImage} preload="metadata" />
                    )
                  ) : null}
                  <span className={styles.bubbleTime}>{formatMessageTime(message.createdAt)}</span>
                </div>
                {mine || message.kind === "system" ? null : (
                  <button
                    type="button"
                    className={reportStyles.messageReport}
                    aria-label="Report message"
                    onClick={() =>
                      requireAuthThen(
                        () => setReportTarget({ kind: "message", conversationId, reportedUser: message.sender ?? peer ?? null, message, alsoBlock: false }),
                        "Sign in to report a message.",
                      )
                    }
                  >
                    Report
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {sendMutation.isError ? (
        <p className={styles.sendError} role="alert">
          {readChatCryptoErrorMessage(sendMutation.error) ?? readErrorMessageForDisplay(sendMutation.error)}
        </p>
      ) : null}
      <form className={styles.composer} onSubmit={handleSend}>
        <label htmlFor="message-draft" className="visuallyHidden">
          Message
        </label>
        <textarea
          id="message-draft"
          className={styles.composerInput}
          rows={1}
          placeholder="Write a message…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendDraft();
            }
          }}
        />
        <button type="submit" className={styles.sendButton} disabled={!draft.trim() || sendMutation.isPending}>
          {sendMutation.isPending ? "…" : "Send"}
        </button>
      </form>
      <ChatReportDialog target={reportTarget} messages={messages} viewerId={viewer?.id ?? ""} onClose={() => setReportTarget(null)} />
    </div>
  );
}
