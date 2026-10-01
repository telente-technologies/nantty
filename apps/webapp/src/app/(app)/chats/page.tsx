"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/ui/media";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { messagesService } from "@/services/messages.service";
import { useQuery } from "@tanstack/react-query";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import type { ConversationFilter } from "@/types";

import styles from "./page.module.css";

const filters: readonly { readonly value: ConversationFilter; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "direct", label: "Direct" },
];

export default function ChatsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [search, setSearch] = useState("");

  const conversationsQuery = useQuery({
    queryKey: ["conversations", filter],
    queryFn: () => messagesService.fetchConversationList(filter),
    retry: false,
    refetchInterval: 15_000,
  });

  const searchResults = useQuery({
    queryKey: ["conversations", "search", search],
    queryFn: () => messagesService.searchConversationsAndPeople(search),
    enabled: search.trim().length >= 2,
    retry: false,
  });

  const conversations = conversationsQuery.data ?? [];
  const visible = search.trim().length >= 2 && searchResults.data ? [] : conversations;
  const people = search.trim().length >= 2 ? (searchResults.data?.people ?? []) : [];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Chats</h1>

      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search chats and people"
          aria-label="Search chats and people"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className={styles.filters} role="group" aria-label="Filter conversations">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              className={[styles.filter, filter === option.value ? styles.filterActive : ""].filter(Boolean).join(" ")}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {conversationsQuery.isLoading ? (
        <Spinner label="Loading chats" />
      ) : conversationsQuery.isError ? (
        <ErrorState description="We couldn't load your chats." action={<RetryButton onRetry={() => conversationsQuery.refetch()} />} />
      ) : search.trim().length >= 2 ? (
        searchResults.isLoading ? (
          <Spinner label="Searching" />
        ) : visible.length === 0 && people.length === 0 ? (
          <EmptyState icon="💬" title="No matches" description="Nobody matched that search." />
        ) : (
          <>
            {people.length > 0 ? (
              <ul className={styles.list}>
                {people.map((person) => (
                  <li key={person.id}>
                    <button type="button" className={styles.row} onClick={() => router.push(`/user/${person.id}`)}>
                      <Avatar name={person.name} src={person.avatarUrl} size="md" />
                      <span className={styles.rowText}>
                        <span className={styles.rowName}>{person.name}</span>
                        <span className={styles.rowHandle}>@{person.username}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )
      ) : conversations.length === 0 ? (
        <EmptyState icon="💬" title="No chats yet" description="Message a seller or a friend to get started." />
      ) : (
        <ul className={styles.list}>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link href={`/chats/${conversation.id}`} className={styles.row}>
                <Avatar name={conversation.peer.name} src={conversation.photoUrl ?? conversation.peer.avatarUrl} size="md" />
                <span className={styles.rowText}>
                  <span className={styles.rowTop}>
                    <span className={styles.rowName}>{conversation.title ?? conversation.peer.name}</span>
                    <span className={styles.rowTime}>{formatTimeSincePosted(conversation.lastMessageAt)}</span>
                  </span>
                  <span className={styles.rowPreview}>{conversation.lastMessage}</span>
                </span>
                {conversation.unread > 0 ? <span className={styles.unread}>{conversation.unread > 99 ? "99+" : conversation.unread}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
