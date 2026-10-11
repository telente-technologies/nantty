"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ConversationListPane, type ConversationFilter } from "@/components/messages/conversationListPane";
import { ConversationThreadPane } from "@/components/messages/conversationThreadPane";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { announceInboxChanged } from "@/hooks/useInboxUnreadCount.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { storeChatEngine } from "@/services/chatCrypto/storeChatEngine";
import type { Conversation, DecryptedPreview } from "@/types/conversation.type";
import { filterConversationsLocally } from "@/utils/storeChat.util";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./messages.module.css";

type ConversationsPage = CursorPage<Conversation> & { readonly unreadConversationsCount: number };

export function MessagesInboxView({ initialConversationId }: { readonly initialConversationId: string | null }) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId);
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [previews, setPreviews] = useState<ReadonlyMap<string, DecryptedPreview>>(new Map());
  const conversationsQuery = useSellerQuery<ConversationsPage>("/seller/conversations", { filter, limit: 50 });
  const reloadConversations = conversationsQuery.reload;
  const conversations = conversationsQuery.data?.data ?? null;
  const conversationIds = useMemo(() => (conversations ?? []).map((conversation) => conversation.id).join(","), [conversations]);
  const [previewVersion, setPreviewVersion] = useState(0);
  const refreshConversationList = useCallback(() => {
    reloadConversations();
    announceInboxChanged();
    setPreviewVersion((version) => version + 1);
  }, [reloadConversations]);
  const visibleConversations = useMemo(() => (conversations === null ? null : filterConversationsLocally(conversations, previews, searchText)), [conversations, previews, searchText]);

  useEffect(() => {
    if (conversationIds === "") return;
    let isCurrent = true;
    storeChatEngine.readPreviews(conversationIds.split(",")).then((found) => isCurrent && setPreviews(found), () => undefined);
    return () => {
      isCurrent = false;
    };
  }, [conversationIds, previewVersion]);

  useEffect(() => {
    storeChatEngine.connectRealtime();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refreshConversationList, 400);
    };
    const stopEvents = storeChatEngine.onEvent((event) => (event.type === "message.created" || event.type === "read") && refreshSoon());
    let isLive = storeChatEngine.realtimeStatus() === "live";
    const stopStatus = storeChatEngine.onStatus((status) => {
      if (status === "live" && !isLive) refreshSoon();
      isLive = status === "live";
    });
    const poll = setInterval(() => !isLive && document.visibilityState === "visible" && refreshConversationList(), 30_000);
    return () => {
      stopEvents();
      stopStatus();
      clearInterval(poll);
      if (timer) clearTimeout(timer);
    };
  }, [refreshConversationList]);

  function selectConversation(conversationId: string) {
    setSelectedConversationId(conversationId);
    window.history.replaceState(null, "", `/messages?conversation=${encodeURIComponent(conversationId)}`);
  }

  function returnToConversationList() {
    setSelectedConversationId(null);
    window.history.replaceState(null, "", "/messages");
  }

  return (
    <PageStack>
      <PageHeader title="Messages" description="Your customer conversations — the same chats as in the Zudomart app. Messages are end-to-end encrypted: only the customer and your team can read them, and new team members only see messages sent after they join." />
      <div className={`${styles.inbox} ${selectedConversationId ? styles.inboxShowingThread : styles.inboxShowingList}`}>
        <ConversationListPane
          conversations={visibleConversations}
          previews={previews}
          isLoading={conversationsQuery.isLoading}
          errorMessage={conversationsQuery.errorMessage}
          selectedConversationId={selectedConversationId}
          filter={filter}
          unreadConversationsCount={conversationsQuery.data?.unreadConversationsCount ?? 0}
          searchText={searchText}
          onFilterChange={setFilter}
          onSearchTextChange={setSearchText}
          onSelectConversation={selectConversation}
        />
        <ConversationThreadPane key={selectedConversationId ?? "none"} conversationId={selectedConversationId} onBack={returnToConversationList} onConversationChanged={refreshConversationList} />
      </div>
    </PageStack>
  );
}
