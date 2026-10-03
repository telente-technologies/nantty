"use client";

import { useCallback, useState } from "react";

import { ConversationListPane, type ConversationFilter } from "@/components/messages/conversationListPane";
import { ConversationThreadPane } from "@/components/messages/conversationThreadPane";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Conversation } from "@/types/conversation.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./messages.module.css";

type ConversationsPage = CursorPage<Conversation> & { readonly unreadConversationsCount: number };

export function MessagesInboxView({ initialConversationId }: { readonly initialConversationId: string | null }) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId);
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [searchText, setSearchText] = useState("");
  const conversationsQuery = useSellerQuery<ConversationsPage>("/seller/conversations", { filter, q: searchText, limit: 50 });
  const reloadConversations = conversationsQuery.reload;
  const refreshConversationList = useCallback(() => reloadConversations(), [reloadConversations]);

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
      <PageHeader title="Messages" description="Your customer conversations — the same chats as in the Zudomart app. Questions about an order show the order so you can jump straight to it." />
      <div className={`${styles.inbox} ${selectedConversationId ? styles.inboxShowingThread : styles.inboxShowingList}`}>
        <ConversationListPane
          conversations={conversationsQuery.data?.data ?? null}
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
