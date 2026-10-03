"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { readInitialsFromName } from "@/components/messages/conversationListPane";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ConversationMessage, ConversationThread } from "@/types/conversation.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./messages.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

export function ConversationThreadPane({ conversationId, onBack, onConversationChanged }: { readonly conversationId: string | null; readonly onBack: () => void; readonly onConversationChanged: () => void }) {
  const { showToast } = useToast();
  const threadQuery = useSellerQuery<ConversationThread>(conversationId ? `/seller/conversations/${encodeURIComponent(conversationId)}` : null);
  const [draftReply, setDraftReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const thread = threadQuery.data;
  const unreadCount = thread?.conversation.unreadCount ?? 0;
  const replaceThread = threadQuery.replaceData;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  useEffect(() => {
    if (!conversationId || unreadCount === 0) return;
    sendSellerApiRequest(`/seller/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" })
      .then(() => {
        replaceThread((current) => (current ? { ...current, conversation: { ...current.conversation, unreadCount: 0 } } : current));
        onConversationChanged();
      })
      .catch(() => undefined);
  }, [conversationId, unreadCount, replaceThread, onConversationChanged]);

  async function sendReplyToCustomer(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const body = draftReply.trim();
    if (!conversationId || body.length === 0) return;
    setIsSending(true);
    try {
      const message = await sendSellerApiRequest<ConversationMessage>(`/seller/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: { body } });
      replaceThread((current) => (current ? { ...current, messages: [...current.messages, message] } : current));
      setDraftReply("");
      onConversationChanged();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSending(false);
    }
  }

  function sendOnEnterWithoutShift(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendReplyToCustomer();
    }
  }

  if (!conversationId) {
    return (
      <section className={styles.threadPane} aria-label="Conversation">
        <div className={styles.placeholder}>
          <EmptyState iconName="chatCircle24" title="Pick a conversation" description="These are the same chats customers see in the Zudomart app. Replies you send here arrive in the app instantly." />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.threadPane} aria-label="Conversation">
      <header className={styles.threadHeader}>
        <IconButton iconName="arrowLeft24" label="Back to conversations" size="small" className={styles.backButton} onClick={onBack} />
        {thread ? (
          <>
            <span className={styles.avatar} aria-hidden="true">
              {readInitialsFromName(thread.conversation.customer.name)}
            </span>
            <span className={styles.conversationText}>
              <span className={styles.conversationName}>{thread.conversation.customer.name}</span>
              <span className={styles.preview}>@{thread.conversation.customer.username}</span>
            </span>
            {thread.conversation.orderId ? (
              <Link href={`/orders/${thread.conversation.orderId}`} className={styles.orderChip} style={{ marginLeft: "auto" }}>
                <IconLabel name="arrowRight24" size={14}>Order {thread.conversation.orderNumber}</IconLabel>
              </Link>
            ) : null}
          </>
        ) : null}
      </header>
      <div className={styles.threadMessages} aria-live="polite">
        {threadQuery.isLoading && !thread ? <LoadingBlock label="Loading messages" /> : null}
        {threadQuery.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={threadQuery.reload}>Try again</Button>}>{threadQuery.errorMessage}</Callout> : null}
        {thread && thread.messages.length === 0 ? <p className={styles.preview}>No messages yet. Say hello — the customer gets it in the Zudomart app.</p> : null}
        {thread?.messages.map((message) => (
          <div key={message.id} className={`${styles.bubble} ${message.from === "seller" ? styles.bubbleFromSeller : ""}`}>
            {message.body}
            <span className={styles.bubbleTime}>
              {message.from === "seller" ? `${message.senderName} · ` : ""}
              {formatDateTimeForDisplay(message.createdAt)}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className={styles.composer} onSubmit={sendReplyToCustomer}>
        <label htmlFor="conversation-reply" className="visuallyHidden">
          Reply
        </label>
        <textarea id="conversation-reply" className={styles.composerInput} placeholder="Write a reply…" rows={1} maxLength={2000} value={draftReply} onChange={(event) => setDraftReply(event.target.value)} onKeyDown={sendOnEnterWithoutShift} disabled={!thread} />
        <Button type="submit" variant="primary" iconName="paperPlaneTilt24" isBusy={isSending} disabled={!thread || draftReply.trim().length === 0}>
          Send
        </Button>
      </form>
    </section>
  );
}
