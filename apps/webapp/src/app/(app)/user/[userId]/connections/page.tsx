"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useDeferredValue, useState } from "react";

import { useFollowUser } from "@/components/follow/useFollowUser.hook";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { followsService } from "@/services/posts.service";
import type { ConnectionEntry, ConnectionTab } from "@/types";
import { buildProfilePath } from "@/utils/seoPaths.util";

import styles from "./page.module.css";

const allTabs: readonly { readonly key: ConnectionTab; readonly label: string }[] = [
  { key: "followers", label: "Followers" },
  { key: "following", label: "Following" },
  { key: "shopped", label: "Shopped" },
  { key: "suggested", label: "Suggested" },
  { key: "blocked", label: "Blocked" },
];

function ConnectionRow({ entry, tab, viewerId, onUnblock, isUnblocking }: { readonly entry: ConnectionEntry; readonly tab: ConnectionTab; readonly viewerId: string | null; readonly onUnblock: () => void; readonly isUnblocking: boolean }) {
  const follow = useFollowUser({ userId: entry.id, username: entry.username, displayName: entry.name, initialState: entry.isFollowing ? "accepted" : "none" });
  return (
    <li className={styles.row}>
      <Link href={buildProfilePath(entry.username)} className={styles.person}>
        <Avatar name={entry.name} src={entry.avatarUrl} size="md" />
        <span className={styles.personText}>
          <strong>{entry.name}</strong>
          <span>@{entry.username}</span>
        </span>
      </Link>
      {tab === "blocked" ? (
        <Button size="sm" variant="secondary" busy={isUnblocking} onClick={onUnblock}>Unblock</Button>
      ) : viewerId && viewerId !== entry.id ? (
        <Button size="sm" variant={follow.isActive ? "secondary" : "primary"} busy={follow.isPending} onClick={follow.toggle}>{follow.label}</Button>
      ) : null}
    </li>
  );
}

export default function ConnectionsPage({ params }: { readonly params: Promise<{ readonly userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { viewer } = useSession();
  const isOwn = viewer?.id === userId;
  const tabs = allTabs.filter((tab) => isOwn || (tab.key !== "blocked" && tab.key !== "shopped"));
  const requestedTab = searchParams.get("tab") as ConnectionTab | null;
  const [tab, setTab] = useState<ConnectionTab>(tabs.some((candidate) => candidate.key === requestedTab) ? requestedTab! : "followers");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const isSearchable = tab === "followers" || tab === "following";
  const list = useQuery({
    queryKey: ["users", userId, "connections", tab, isSearchable ? deferredSearch : ""],
    queryFn: async () => {
      if (tab === "followers") return (await followsService.listFollowersOfUser(userId, deferredSearch)).data;
      if (tab === "following") return (await followsService.listFollowingOfUser(userId, deferredSearch)).data;
      if (tab === "blocked") return followsService.listMyBlockedUsers();
      return followsService.listConnectionsOfUser(userId, tab);
    },
    retry: (failureCount, error) => (error as { status?: number }).status !== 403 && failureCount < 2,
  });
  const unblock = useMutation({
    mutationFn: (entry: ConnectionEntry) => followsService.unblockUser(entry.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", userId, "connections"] }),
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const isPrivate = (list.error as { status?: number } | null)?.status === 403;
  const chooseTab = (next: ConnectionTab) => {
    setTab(next);
    router.replace(`/user/${encodeURIComponent(userId)}/connections?tab=${next}`, { scroll: false });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} aria-label="Back" onClick={() => router.back()}><ArrowLeftIcon size={18} /></button>
        <h1 className={styles.title}>Connections</h1>
      </header>
      {isSearchable ? <input type="search" className={styles.search} placeholder="Search" aria-label="Search connections" value={search} onChange={(event) => setSearch(event.target.value)} /> : null}
      <div className={styles.tabs} role="tablist" aria-label="Connections">
        {tabs.map((candidate) => (
          <button key={candidate.key} type="button" role="tab" aria-selected={candidate.key === tab} className={styles.tab} onClick={() => chooseTab(candidate.key)}>{candidate.label}</button>
        ))}
      </div>
      {list.isPending ? (
        <div className={styles.list} aria-hidden="true">{[0, 1, 2, 3].map((index) => <Skeleton key={index} height={56} />)}</div>
      ) : isPrivate ? (
        <ErrorState kind="contentPrivate" description="This account is private. Follow them to see their followers and following." />
      ) : list.isError ? (
        <ErrorState description="Couldn't load this list." error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title={search.trim() && isSearchable ? `No one matches “${search.trim()}”` : "Nobody here yet"} />
      ) : (
        <ul className={styles.list}>
          {list.data.map((entry) => (
            <ConnectionRow key={entry.id} entry={entry} tab={tab} viewerId={viewer?.id ?? null} onUnblock={() => unblock.mutate(entry)} isUnblocking={unblock.isPending && unblock.variables?.id === entry.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
