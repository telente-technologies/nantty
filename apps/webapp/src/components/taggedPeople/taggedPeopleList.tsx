"use client";

import Link from "next/link";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { useSession } from "@/components/providers/sessionProvider";
import { AppIcon } from "@/components/ui/appIcon";
import { Avatar } from "@/components/ui/media";
import { followsService, postsService } from "@/services/posts.service";
import type { Post, TaggedUser } from "@/types";
import { buildProfilePath } from "@/utils/seoPaths.util";

import styles from "./taggedPeople.module.css";

type TaggedSource = Pick<Post, "id" | "taggedUsers" | "taggedUsersCount">;

export const countTaggedPeople = (post: Pick<Post, "taggedUsers" | "taggedUsersCount">) => Math.max(post.taggedUsersCount ?? 0, post.taggedUsers?.length ?? 0);

const CHECKMARK_LABELS = { blue: "Verified account", gold: "Verified business", black: "Official government account" } as const;

function TaggedPersonRow({ person, onClose }: { readonly person: TaggedUser; readonly onClose: () => void }) {
  const { viewer } = useSession();
  const [isFollowing, setIsFollowing] = useState(person.isFollowing ?? false);
  const follow = useMutation({
    mutationFn: (next: boolean) => (next ? followsService.followUser(person.id) : followsService.unfollowUser(person.id)),
    onMutate: (next) => setIsFollowing(next),
    onError: (_error, next) => setIsFollowing(!next),
  });
  const toggleFollow = () => {
    if (!viewer) onClose();
    requireAuthThen(() => follow.mutate(!isFollowing), `Sign in to follow ${person.displayName}.`);
  };
  return (
    <li className={styles.row}>
      <Link href={buildProfilePath(person.username)} className={styles.identity} onClick={onClose}>
        <Avatar name={person.displayName} src={person.avatarUrl} size="md" />
        <span className={styles.names}>
          <span className={styles.displayName}>
            <span className={styles.truncate}>{person.displayName}</span>
            {person.checkmark ? (
              <span className={styles.checkmark} data-color={person.checkmark} role="img" aria-label={CHECKMARK_LABELS[person.checkmark]}>
                <AppIcon name="check16" size={10} />
              </span>
            ) : null}
          </span>
          <span className={styles.username}>@{person.username}</span>
        </span>
      </Link>
      {viewer?.id === person.id ? null : (
        <button type="button" className={[styles.follow, isFollowing ? styles.following : ""].join(" ")} aria-pressed={isFollowing} aria-label={`${isFollowing ? "Unfollow" : "Follow"} ${person.displayName}`} onClick={toggleFollow}>
          {isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </li>
  );
}

export function TaggedPeopleList({ post, isOpen, onClose }: { readonly post: TaggedSource; readonly isOpen: boolean; readonly onClose: () => void }) {
  const inline = post.taggedUsers ?? [];
  const needsFetch = countTaggedPeople(post) > inline.length;
  const query = useInfiniteQuery({
    queryKey: ["posts", "taggedUsers", post.id],
    queryFn: ({ pageParam }) => postsService.fetchPostTaggedUsers(post.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isOpen && needsFetch,
  });
  const fetched = query.data?.pages.flatMap((page) => page.data) ?? [];
  const people = fetched.length > 0 ? fetched : inline;
  return (
    <>
      <ul className={styles.list}>
        {people.map((person) => (
          <TaggedPersonRow key={person.id} person={person} onClose={onClose} />
        ))}
      </ul>
      {query.isError && fetched.length === 0 ? <p className={styles.note}>Couldn&apos;t load everyone tagged.</p> : null}
      {query.hasNextPage || query.isFetching ? (
        <button type="button" className={styles.more} disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>
          {query.isFetching ? "Loading…" : "Show more"}
        </button>
      ) : null}
    </>
  );
}
