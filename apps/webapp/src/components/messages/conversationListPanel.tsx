"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { usePopoverMenu } from "@/components/ui/popoverMenu.hook";
import sheetStyles from "@/components/ui/popoverMenu.module.css";
import menuStyles from "@/components/actions/contentActionsMenu.module.css";

import { Avatar } from "@/components/ui/media";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui/feedback";
import { InlineLink } from "@/components/ui/controls";
import { messagesService } from "@/services/messages.service";
import { webappRealtime } from "@/services/realtime/webappRealtime.service";
import { useRealtimeStatus } from "@nantty/web-kit/src/realtime/realtimeHooks";
import { useQueries, useQuery } from "@tanstack/react-query";
import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import type { Conversation, ConversationFilter, InboxFolder } from "@/types";

import styles from "./conversationListPanel.module.css";
import { AppIcon, type AppIconName } from "@/components/ui/appIcon";
import { InboxRequestActions } from "./inboxRequestActions";
import { groupAttributesQueryKey, useConversationDisplay } from "./conversationDisplay.hook";
import { NewGroupDialog } from "./newGroupDialog";
import { NewMessageDialog } from "./newMessageDialog";
import { conversationUnreadCount, conversationUnreadLabel } from "./conversationUnreadLabel";

function ConversationRowLink({ conversation, isActive }: { readonly conversation: Conversation; readonly isActive: boolean }) {
  const display = useConversationDisplay(conversation);
  return (
    <Link href={`/chats/${conversation.id}`} className={[styles.row, isActive ? styles.rowActive : ""].join(" ")} aria-current={isActive ? "page" : undefined}>
      <Avatar name={display.name} src={display.avatarSrc} size="md" />
      <span className={styles.rowText}>
        <span className={styles.rowTop}>
          <span className={styles.rowName}>{display.name}</span>
          <span className={styles.rowTime}>{formatTimeSincePosted(conversation.lastMessageAt)}</span>
        </span>
        <span className={styles.rowPreview}>{conversation.lastMessage || (display.isGroup ? "Encrypted group" : "")}</span>
      </span>
      {conversation.unread > 0 ? (
        <>
          <span className={styles.unread} aria-hidden="true">{conversationUnreadCount(conversation.unread)}</span>
          <span className={styles.unreadAssistive}>{conversationUnreadLabel(conversation.unread)}</span>
        </>
      ) : null}
    </Link>
  );
}

const filters: readonly { readonly value: ConversationFilter; readonly label: string }[] = [
  { value: "all", label: "All Messages" },
  { value: "direct", label: "Direct Messages" },
];

const inboxFolderLabels: Record<InboxFolder, string> = { chats: "Chats", requests: "Requests", spam: "Spam" };
const inboxFolderIcons: Record<InboxFolder, AppIconName> = { chats: "chatCircle24", requests: "userPlus24", spam: "prohibit24" };

function InboxFolderMenu({ folder, onSelect }: { readonly folder: InboxFolder; readonly onSelect: (folder: InboxFolder) => void }) {
  const { isOpen, close, containerRef, triggerRef, menuRef, triggerProps, menuProps } = usePopoverMenu();
  return (
    <div className={`${menuStyles.container} ${styles.folderMenu}`} ref={containerRef}>
      <button type="button" className={styles.folderTrigger} aria-label={`${inboxFolderLabels[folder]}, change inbox folder`} ref={triggerRef} {...triggerProps}>
        <h1 className={styles.title}>{inboxFolderLabels[folder]}</h1>
        <AppIcon name="caretDown24" size={16} />
      </button>
      {isOpen ? <div className={sheetStyles.scrim} aria-hidden="true" onPointerDown={() => close()} /> : null}
      {isOpen ? (
        <div className={`${menuStyles.menu} ${sheetStyles.sheet} ${styles.folderMenuList}`} aria-label="Inbox folders" ref={menuRef} {...menuProps}>
          {(Object.keys(inboxFolderLabels) as InboxFolder[]).map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === folder}
              className={menuStyles.item}
              onClick={() => {
                close(true);
                onSelect(option);
              }}
            >
              <AppIcon name={inboxFolderIcons[option]} size={20} />
              <span className={option === folder ? styles.folderActive : undefined}>{inboxFolderLabels[option]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <ul className={styles.list} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <li key={index} className={styles.skeletonRow}>
          <Skeleton width={44} height={44} circle />
          <span className={styles.rowText}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="80%" height={12} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ConversationListPanel({ activeConversationId }: { readonly activeConversationId: string | null }) {
  const router = useRouter();
  const { viewer } = useSession();
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [folder, setFolder] = useState<InboxFolder>("chats");
  const [search, setSearch] = useState("");
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const isRealtime = useRealtimeStatus(webappRealtime) === "live";

  const conversationsQuery = useQuery({
    queryKey: ["conversations", filter, folder],
    queryFn: () => (folder === "chats" ? messagesService.fetchConversationList(filter) : messagesService.fetchInboxFolder(folder)),
    retry: false,
    refetchInterval: isRealtime ? 60_000 : 15_000,
  });

  const searchResults = useQuery({
    queryKey: ["conversations", "search", search],
    queryFn: () => messagesService.searchConversationsAndPeople(search),
    enabled: search.trim().length >= 2,
    retry: false,
  });

  const conversations = conversationsQuery.data ?? [];
  const groups = conversations.filter((conversation) => conversation.kind === "group" && conversation.encryptedAttributes);
  const groupNames = useQueries({
    queries: groups.map((conversation) => ({
      queryKey: [...groupAttributesQueryKey(conversation.id), conversation.encryptedAttributes ?? null],
      queryFn: () => chatCryptoService.openGroupAttributes(viewer?.id ?? "", conversation.id, conversation.encryptedAttributes),
      enabled: Boolean(viewer?.id) && search.trim().length >= 2,
      staleTime: 30_000,
    })),
  });
  const needle = search.trim().toLowerCase();
  const serverMatchIds = new Set((searchResults.data?.conversations ?? []).map((match) => match.id));
  const localGroupMatches = groups.filter((_conversation, index) => (groupNames[index]?.data?.title ?? "").toLowerCase().includes(needle));
  const visible = search.trim().length >= 2 ? [...conversations.filter((conversation) => serverMatchIds.has(conversation.id)), ...localGroupMatches] : conversations;
  const people = search.trim().length >= 2 ? (searchResults.data?.people ?? []) : [];

  return (
    <section className={styles.page} aria-label="Messages">
      <div className={styles.titleRow}>
        <InboxFolderMenu folder={folder} onSelect={setFolder} />
        <span className={styles.titleActions}>
          <Link href="/chats/settings" className={styles.newMessage} aria-label="Chat settings">
            <AppIcon name="slidersHorizontal24" size={20} />
          </Link>
          <button type="button" className={styles.newMessage} aria-label="New group" onClick={() => setIsNewGroupOpen(true)}>
            <AppIcon name="userPlus24" size={20} />
          </button>
          <button type="button" className={styles.newMessage} aria-label="New message" onClick={() => setIsNewMessageOpen(true)}>
            <AppIcon name="paperPlaneTilt24" size={20} />
          </button>
        </span>
      </div>
      <NewMessageDialog isOpen={isNewMessageOpen} onClose={() => setIsNewMessageOpen(false)} />
      <NewGroupDialog isOpen={isNewGroupOpen} onClose={() => setIsNewGroupOpen(false)} />

      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search chats and people"
          aria-label="Search chats and people"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {folder === "chats" ? (
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
        ) : null}
      </div>

      <div className={styles.results}>
        {conversationsQuery.isLoading ? (
          <ConversationListSkeleton />
        ) : conversationsQuery.isError ? (
          <ErrorState description="Couldn't load your messages." error={conversationsQuery.error} onRetry={() => void conversationsQuery.refetch()} />
        ) : search.trim().length >= 2 ? (
          searchResults.isLoading ? (
            <Spinner label="Searching" />
          ) : visible.length === 0 && people.length === 0 ? (
            <EmptyState kind="search" title="No matches" description="Nobody matched that search." />
          ) : (
            <>
              {visible.length > 0 ? (
                <ul className={styles.list} aria-label="Matching chats">
                  {visible.map((conversation) => (
                    <li key={conversation.id}>
                      <ConversationRowLink conversation={conversation} isActive={activeConversationId === conversation.id} />
                    </li>
                  ))}
                </ul>
              ) : null}
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
          folder !== "chats" ? (
            <EmptyState icon={<AppIcon name={inboxFolderIcons[folder]} size={28} />} title={folder === "requests" ? "No message requests." : "No chats flagged as spam."} />
          ) : (
            <EmptyState kind="inbox" title="No chats yet" description="Message a seller or a friend to get started." action={<InlineLink href="/explore">Find people</InlineLink>} />
          )
        ) : (
          <ul className={styles.list}>
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <ConversationRowLink conversation={conversation} isActive={activeConversationId === conversation.id} />
                {folder === "chats" ? null : <InboxRequestActions conversation={conversation} viewerId={viewer?.id ?? ""} showExplanation />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
