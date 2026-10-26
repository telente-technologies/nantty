"use client";

import { BrandLoader } from "@nantty/web-kit";

import { EmptyState } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import type { Conversation, DecryptedPreview } from "@/types/conversation.type";
import { previewFor } from "@/utils/storeChat.util";
import { formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./messages.module.css";

export type ConversationFilter = "all" | "unread" | "orders";

export function readInitialsFromName(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

interface ConversationListPaneProps {
  readonly conversations: readonly Conversation[] | null;
  readonly previews: ReadonlyMap<string, DecryptedPreview>;
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
  readonly selectedConversationId: string | null;
  readonly filter: ConversationFilter;
  readonly unreadConversationsCount: number;
  readonly searchText: string;
  readonly onFilterChange: (filter: ConversationFilter) => void;
  readonly onSearchTextChange: (searchText: string) => void;
  readonly onSelectConversation: (conversationId: string) => void;
}

export function ConversationListPane({ conversations, previews, isLoading, errorMessage, selectedConversationId, filter, unreadConversationsCount, searchText, onFilterChange, onSearchTextChange, onSelectConversation }: ConversationListPaneProps) {
  return (
    <section className={styles.listPane} aria-label="Conversations">
      <div className={styles.listHeader}>
        <SearchInput label="Search conversations" placeholder="Customer, @username or order" value={searchText} onValueChange={onSearchTextChange} />
        <SegmentedControl
          label="Show"
          value={filter}
          onValueChange={onFilterChange}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: unreadConversationsCount > 0 ? `Unread (${unreadConversationsCount})` : "Unread" },
            { value: "orders", label: "Orders" },
          ]}
        />
      </div>
      <div className={styles.conversationList}>
        {isLoading && !conversations ? <BrandLoader size="md" label="Loading conversations" fill="section" /> : null}
        {errorMessage ? <p role="alert" style={{ padding: 12 }}>{errorMessage}</p> : null}
        {conversations && conversations.length === 0 ? (
          <EmptyState iconName="chatCircle24" title={filter === "unread" ? "You are all caught up" : "No conversations found"} description="Messages customers send you in the Nantty app show up here." />
        ) : null}
        <ul>
          {(conversations ?? []).map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                className={`${styles.conversationButton} ${conversation.unreadCount > 0 ? styles.unread : ""}`}
                aria-current={conversation.id === selectedConversationId ? "true" : undefined}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {readInitialsFromName(conversation.customer.name)}
                </span>
                <span className={styles.conversationText}>
                  <span className={styles.conversationName}>{conversation.customer.name}</span>
                  <span className={styles.preview}>
                    {previewFor(conversation, previews)}
                  </span>
                  {conversation.orderNumber ? <span className={styles.orderChip}>Order {conversation.orderNumber}</span> : null}
                </span>
                <span className={styles.meta}>
                  <span>{formatRelativeTimeFromNow(conversation.updatedAt)}</span>
                  {conversation.unreadCount > 0 ? (
                    <span className={styles.unreadBadge}>
                      {conversation.unreadCount}
                      <span className="visuallyHidden"> unread</span>
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
