"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { ChatActionsMenu } from "@/components/chatReport/chatActionsMenu";
import { ChatReportDialog } from "@/components/chatReport/chatReportDialog";
import type { ChatReportTarget } from "@/components/chatReport/chatReportTarget.type";
import reportStyles from "@/components/chatReport/chatReport.module.css";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { Avatar } from "@/components/ui/media";
import { ArrowLeftIcon, SettingsIcon } from "@/components/ui/icons";
import { ErrorState } from "@/components/ui/feedback";
import { ChatMessagesSkeleton } from "@/components/ui/pageSkeletons";
import { useSession } from "@/components/providers/sessionProvider";
import { ChatComposerTools } from "@/components/messages/chatComposerTools";
import { ChatMessageBubble } from "@/components/messages/chatMessageBubble";
import { groupAttributesQueryKey, useConversationDisplay } from "@/components/messages/conversationDisplay.hook";
import { InboxRequestActions } from "@/components/messages/inboxRequestActions";
import { useLiveLocationSharing } from "@/components/messages/liveLocationSharing.hook";
import { useOptimisticSends } from "@/components/messages/optimisticSends.hook";
import { SecurityCodeChangedBanner } from "@/components/messages/secureChatNotices";
import { readChatCryptoErrorMessage } from "@/services/chatCrypto/chatCrypto.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatControl } from "@zudomart/chat-crypto";
import { nextPollVote } from "@zudomart/chat-crypto";
import type { Message } from "@/types";
import { buildChatThread } from "@/utils/chatThread.util";
import { mergeOptimisticMessages } from "@/utils/chatOptimistic.util";

import styles from "./page.module.css";

export default function ConversationPage({ params }: { readonly params: Promise<{ readonly conversationId: string }> }) {
  const { conversationId } = use(params);
  const { viewer } = useSession();
  const viewerId = viewer?.id ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraftState] = useState("");
  const draftRef = useRef("");
  const setDraft = (value: string) => {
    draftRef.current = value;
    setDraftState(value);
  };
  const [reportTarget, setReportTarget] = useState<ChatReportTarget | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const conversationQuery = useQuery({
    queryKey: ["conversations", "detail", conversationId],
    queryFn: () => messagesService.fetchConversationById(conversationId),
    retry: false,
  });
  const conversation = conversationQuery.data;
  const display = useConversationDisplay(conversation);

  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) => messagesService.fetchDecryptedMessagesInConversation(conversationId, viewerId, { cursor: pageParam }),
    enabled: Boolean(viewer?.id),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 5_000,
  });

  const readMutation = useMutation({
    mutationFn: () => messagesService.markConversationAsRead(conversationId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });

  const inboxFolder = conversation?.inboxFolder ?? "chats";
  const isConversationLoaded = Boolean(conversation);
  const markedReadConversationId = useRef<string | null>(null);
  useEffect(() => {
    if (!isConversationLoaded || inboxFolder !== "chats" || markedReadConversationId.current === conversationId) return;
    markedReadConversationId.current = conversationId;
    readMutation.mutate();
  }, [conversationId, isConversationLoaded, inboxFolder]);

  const [rollbackError, setRollbackError] = useState<unknown>(null);
  const optimistic = useOptimisticSends(conversationId, viewerId, useCallback((error: unknown) => setRollbackError(error), []));
  const serverMessages = useMemo(() => (messagesQuery.data?.pages ?? []).flatMap((page) => page.data), [messagesQuery.data]);
  const allMessages = useMemo(() => mergeOptimisticMessages(serverMessages, optimistic.pending), [serverMessages, optimistic.pending]);
  const thread = useMemo(() => buildChatThread(allMessages, viewerId, new Date()), [allMessages, viewerId]);
  const messages = thread.visible;
  useLiveLocationSharing(conversation, viewerId, messages);

  const controlCount = serverMessages.length - messages.length;
  useEffect(() => {
    if (display.isEncryptedNamePending) void queryClient.invalidateQueries({ queryKey: groupAttributesQueryKey(conversationId) });
  }, [controlCount, display.isEncryptedNamePending, conversationId, queryClient]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const isNearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 180;
    if (isNearBottom) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const sendDraft = () => {
    const text = draftRef.current.trim();
    if (!text || !conversation || !viewer?.id) return;
    const sender = viewer.id;
    setDraft("");
    setRollbackError(null);
    optimistic.send({ kind: "text", text }, (key) => messagesService.sendChatMessage(conversation, sender, text, key));
    bottomRef.current?.scrollIntoView({ block: "end" });
  };

  const sendControl = (control: ChatControl) => {
    if (!conversation || !viewer?.id) return;
    const sender = viewer.id;
    setRollbackError(null);
    optimistic.send({ kind: "control", control }, (key) => messagesService.sendControl(conversation, sender, control, key));
  };

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendDraft();
  }

  const reactTo = (message: Message, emoji: string, reactedByMe: boolean) => sendControl({ type: "reaction", targetMessageId: message.id, emoji, remove: reactedByMe });
  const voteOn = (message: Message, optionId: string) => {
    if (!message.poll) return;
    sendControl({ type: "pollVote", targetMessageId: message.id, optionIds: nextPollVote(thread.ledger.myVote(message.id, viewerId), optionId, message.poll.allowMultipleAnswers) });
  };
  const stopLocation = (message: Message) => sendControl({ type: "locationStop", targetMessageId: message.id });

  const peer = conversation?.peer;
  const isInboxRequest = Boolean(conversation) && inboxFolder !== "chats";
  const isChannelReader = conversation?.kind === "channel" && conversation.myRole !== "owner" && conversation.myRole !== "admin";
  const sendError = rollbackError;
  const isBusinessCustomer = conversation?.kind === "business";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/chats" className={styles.back} aria-label="Back to chats">
          <ArrowLeftIcon size={20} />
        </Link>
        {peer ? (
          <Link href={`/chats/${conversationId}/info`} className={styles.headerIdentity} aria-label={`${display.name}, chat info`}>
            <Avatar name={display.name} src={display.avatarSrc} size="sm" />
            <span className={styles.headerText}>
              <span className={styles.headerName}>{display.name}</span>
              {display.subtitle ? <span className={styles.headerHandle}>{display.subtitle}</span> : null}
            </span>
          </Link>
        ) : (
          <span className={styles.headerName}>Conversation</span>
        )}
        {conversation ? (
          <>
            <Link href={`/chats/${conversationId}/info`} className={styles.back} aria-label="Chat settings">
              <SettingsIcon size={20} />
            </Link>
            <ChatActionsMenu conversation={conversation} onStartReport={(target) => setReportTarget({ ...target, conversationId })} />
          </>
        ) : null}
      </header>

      {isInboxRequest && conversation ? (
        <div className={styles.requestBanner} role="region" aria-label={inboxFolder === "spam" ? "Spam chat" : "Message request"}>
          <InboxRequestActions conversation={conversation} viewerId={viewerId} showExplanation onRemoved={() => router.push("/chats")} />
        </div>
      ) : null}

      {conversation && viewer?.id ? (
        <SecurityCodeChangedBanner viewerId={viewer.id} peerIds={(conversation.kind ?? "direct") === "group" ? [] : [conversation.peer.id]} peerName={conversation.peer.name} />
      ) : null}
      <div className={styles.messages} ref={listRef}>
        {messagesQuery.hasNextPage ? (
          <button type="button" className={styles.loadOlder} disabled={messagesQuery.isFetchingNextPage} onClick={() => void messagesQuery.fetchNextPage()}>
            {messagesQuery.isFetchingNextPage ? "Loading…" : "Load earlier messages"}
          </button>
        ) : null}
        {messagesQuery.isLoading ? (
          <ChatMessagesSkeleton label="Loading messages" />
        ) : messagesQuery.isError ? (
          <ErrorState description="We couldn't load this conversation." error={messagesQuery.error} onRetry={() => void messagesQuery.refetch()} />
        ) : messages.length === 0 ? (
          <p className={styles.empty}>Say hello — messages you send are end-to-end encrypted.</p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === viewerId;
            return (
              <ChatMessageBubble
                key={message.id}
                message={message}
                mine={mine}
                showSender={display.isGroup || isBusinessCustomer}
                senderLabel={isBusinessCustomer && !mine ? display.name : null}
                styles={styles}
                isBusy={false}
                onRetry={optimistic.retry}
                onDiscard={optimistic.discard}
                onReact={reactTo}
                onVote={voteOn}
                onStopLocation={stopLocation}
                reportButton={
                  mine || message.deliveryState ? null : (
                    <button
                      type="button"
                      className={reportStyles.messageReport}
                      aria-label="Report message"
                      onClick={() => requireAuthThen(() => setReportTarget({ kind: "message", conversationId, reportedUser: message.sender ?? peer ?? null, message, alsoBlock: false }), "Sign in to report a message.")}
                    >
                      Report
                    </button>
                  )
                }
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {sendError ? (
        <p className={styles.sendError} role="alert">
          {readChatCryptoErrorMessage(sendError) ?? readErrorMessageForDisplay(sendError)}
        </p>
      ) : null}
      {isInboxRequest || isChannelReader ? null : (
        <form className={styles.composer} onSubmit={handleSend}>
          {conversation && viewer?.id ? <ChatComposerTools conversation={conversation} viewerId={viewer.id} sendOptimistically={optimistic.send} /> : null}
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
          <button type="submit" className={styles.sendButton} disabled={!draft.trim()}>
            Send
          </button>
        </form>
      )}
      <ChatReportDialog target={reportTarget} messages={messages.filter((message) => !message.deliveryState)} viewerId={viewerId} onClose={() => setReportTarget(null)} />
    </div>
  );
}
