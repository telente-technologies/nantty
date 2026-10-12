"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { contentService } from "@/services/content.service";
import type { ModeratorSummary } from "@/types/studioLive.type";

import styles from "./settings.module.css";

export const MAX_DEFAULT_MODERATORS = 20;

function Person({ person }: { readonly person: ModeratorSummary }) {
  return (
    <span className={styles.person}>
      <Avatar name={person.name || person.username} src={person.avatarUrl} size="sm" />
      <span className={styles.personText}>
        <span>{person.name || person.username}</span>
        <span className={styles.handle}>{`@${person.username}`}</span>
      </span>
    </span>
  );
}

interface ModeratorPickerProps {
  readonly selected: readonly ModeratorSummary[];
  readonly onChange: (next: readonly ModeratorSummary[]) => void;
}

export function ModeratorPicker({ selected, onChange }: ModeratorPickerProps) {
  const [search, setSearch] = useState("");
  const followers = useInfiniteQuery({
    queryKey: ["followers", "me"],
    queryFn: ({ pageParam }) => contentService.listFollowers(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const term = search.trim().toLowerCase().replace(/^@/, "");
  const selectedIds = new Set(selected.map((person) => person.id));
  const candidates = (followers.data?.pages.flatMap((page) => page.data) ?? [])
    .filter((person) => !selectedIds.has(person.id))
    .filter((person) => !term || person.username.toLowerCase().includes(term) || person.name.toLowerCase().includes(term));
  const full = selected.length >= MAX_DEFAULT_MODERATORS;

  return (
    <div className={styles.stack}>
      {selected.length > 0 ? (
        <ul className={styles.pickerResults} aria-label={`${selected.length} default moderators`}>
          {selected.map((person) => (
            <li key={person.id} className={styles.pickerRow}>
              <Person person={person} />
              <Button variant="ghost" size="sm" aria-label={`Remove ${person.name || person.username} as moderator`} onClick={() => onChange(selected.filter((entry) => entry.id !== person.id))}>Remove</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.status}>No default moderators. Moderators can delete comments, mute and ban viewers in your lives.</p>
      )}
      <TextField label="Add a moderator from your followers" type="search" value={search} placeholder="Search by name or @username" hint={full ? `You've reached the limit of ${MAX_DEFAULT_MODERATORS}.` : undefined} onChange={(event) => setSearch(event.target.value)} />
      {followers.isError ? <ErrorState title="Followers didn't load" error={followers.error} onRetry={() => void followers.refetch()} /> : null}
      {followers.isLoading ? <Skeleton height={120} /> : null}
      {followers.isSuccess ? (
        candidates.length === 0 ? (
          <p className={styles.status}>{term ? "No followers match that search." : "Only followers can be added as moderators. None left to add."}</p>
        ) : (
          <ul className={styles.pickerResults} aria-label="Followers you can add">
            {candidates.slice(0, 50).map((person) => (
              <li key={person.id} className={styles.pickerRow}>
                <Person person={person} />
                <Button variant="secondary" size="sm" disabled={full} aria-label={`Add ${person.name || person.username} as moderator`} onClick={() => onChange([...selected, { id: person.id, name: person.name, username: person.username, avatarUrl: person.avatarUrl }])}>Add</Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {followers.hasNextPage ? (
        <div>
          <Button variant="quiet" size="sm" busy={followers.isFetchingNextPage} onClick={() => void followers.fetchNextPage()}>Load more followers</Button>
        </div>
      ) : null}
    </div>
  );
}
