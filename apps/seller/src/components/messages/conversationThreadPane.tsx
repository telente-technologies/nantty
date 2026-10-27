"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import { BrandLoader } from "@nantty/web-kit";

import { readInitialsFromName } from "@/components/messages/conversationListPane";
import { MessageBubble } from "@/components/messages/messageBubble";
import { SecureChatSetupCard } from "@/components/messages/secureChatSetupCard";
import { ThreadComposer } from "@/components/messages/threadComposer";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toastProvider";
import { IconLabel } from "@/components/ui/nanttyIcon";
import { useStoreThread } from "@/hooks/useStoreThread.hook";
import { foldStoreThread, isSeenByCustomer } from "@/utils/storeChat.util";

import styles from "./messages.module.css";

export function ConversationThreadPane({ conversationId, onBack, onConversationChanged }: { readonly conversationId: string | null; readonly onBack: () => void; readonly onConversationChanged: () => void }) {
  const { showToast } = useToast();
  const { sessionView } = useSellerSession();
  const viewerId = sessionView?.user.id ?? null;
  const thread = useStoreThread(conversationId, viewerId, sessionView?.user.name ?? "You", onConversationChanged);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversation = thread.conversation;
  const { visible, ledger } = useMemo(() => foldStoreThread([...thread.messages, ...thread.outgoing]), [thread.messages, thread.outgoing]);
  const lastSeenId = useMemo(() => [...visible].reverse().find((message) => isSeenByCustomer(message, conversation?.customerLastReadAt))?.id ?? null, [visible, conversation?.customerLastReadAt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [visible.length, thread.isCustomerTyping]);

  if (!conversationId) {
    return (
      <section className={styles.threadPane} aria-label="Conversation">
        <div className={styles.placeholder}>
          <EmptyState iconName="chatCircle24" title="Pick a conversation" description="These are the same chats customers see in the Nantty app. Replies are end-to-end encrypted on this device before they're sent." />
        </div>
      </section>
    );
  }

  if (thread.setupState === "checking" || thread.setupState === "needsSetup" || thread.setupState === "settingUp") {
    return (
      <section className={styles.threadPane} aria-label="Conversation">
        <header className={styles.threadHeader}>
          <IconButton iconName="arrowLeft24" label="Back to conversations" size="small" className={styles.backButton} onClick={onBack} />
        </header>
        <div className={styles.placeholder}>
          {thread.setupState === "checking" ? <BrandLoader size="md" label="Checking secure chat on this browser" /> : <SecureChatSetupCard isBusy={thread.setupState === "settingUp"} errorMessage={thread.errorMessage} onSetUp={() => void thread.setUpThisBrowser()} />}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.threadPane} aria-label="Conversation">
      <header className={styles.threadHeader}>
        <IconButton iconName="arrowLeft24" label="Back to conversations" size="small" className={styles.backButton} onClick={onBack} />
        {conversation ? (
          <>
            <span className={styles.avatar} aria-hidden="true">{readInitialsFromName(conversation.customer.name)}</span>
            <span className={styles.conversationText}>
              <span className={styles.conversationName}>{conversation.customer.name}</span>
              <span className={styles.preview}>{thread.isCustomerTyping ? "typing…" : `@${conversation.customer.username}`}</span>
            </span>
            {conversation.orderId ? (
              <Link href={`/orders/${conversation.orderId}`} className={styles.orderChip} style={{ marginLeft: "auto" }}>
                <IconLabel name="arrowRight24" size={14}>Order {conversation.orderNumber}</IconLabel>
              </Link>
            ) : null}
          </>
        ) : null}
      </header>
      {thread.status !== "live" ? (
        <p className={styles.threadStatus} role="status">
          <IconLabel name="wifiSlash20" size={14}>{thread.status === "connecting" ? "Connecting to live updates…" : "Live updates are paused. New messages are checked every few seconds."}</IconLabel>
        </p>
      ) : null}
      <div className={styles.threadMessages} aria-live="polite">
        <p className={styles.preview}><IconLabel name="lockKey24" size={14}>Messages are end-to-end encrypted. New team members only see messages sent after they join.</IconLabel></p>
        {thread.isLoading && thread.messages.length === 0 ? <BrandLoader size="md" label="Loading messages" /> : null}
        {thread.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={thread.reload}>Try again</Button>}>{thread.errorMessage}</Callout> : null}
        {conversation && !thread.isLoading && visible.length === 0 ? <p className={styles.preview}>No messages yet. Say hello — the customer gets it in the Nantty app.</p> : null}
        {visible.map((message) => (
          <MessageBubble key={message.id} message={message} reactions={ledger.reactions(message.id, viewerId ?? "")} isSeen={message.id === lastSeenId} onRetry={thread.retry} onDiscard={thread.discard} />
        ))}
        {thread.isCustomerTyping ? <p className={styles.typingIndicator}>{conversation?.customer.name ?? "The customer"} is typing…</p> : null}
        <div ref={messagesEndRef} />
      </div>
      <ThreadComposer
        conversationId={conversationId}
        order={conversation?.orderId && conversation.orderNumber ? { id: conversation.orderId, orderNumber: conversation.orderNumber } : null}
        disabled={!conversation || !viewerId}
        onSend={thread.send}
        onError={(message) => showToast(message, "error")}
      />
    </section>
  );
}
