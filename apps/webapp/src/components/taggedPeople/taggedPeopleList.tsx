"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useFollowUser } from "@/components/follow/useFollowUser.hook";
import { useSession } from "@/components/providers/sessionProvider";
import { AppIcon } from "@/components/ui/appIcon";
import { Avatar } from "@/components/ui/media";
import { postsService } from "@/services/posts.service";
import type { Post, TaggedUser } from "@/types";
import { buildProfilePath } from "@/utils/seoPaths.util";

import styles from "./taggedPeople.module.css";

type TaggedSource = Pick<Post, "id" | "taggedUsers" | "taggedUsersCount">;

export const countTaggedPeople = (post: Pick<Post, "taggedUsers" | "taggedUsersCount">) => Math.max(post.taggedUsersCount ?? 0, post.taggedUsers?.length ?? 0);

const CHECKMARK_LABELS = { blue: "Verified account", gold: "Verified business", black: "Official government account" } as const;

function TaggedPersonRow({ person, onClose }: { readonly person: TaggedUser; readonly onClose: () => void }) {
  const { viewer } = useSession();
  const follow = useFollowUser({ userId: person.id, username: person.username, displayName: person.displayName, initialState: person.isFollowing ? "accepted" : "none" });
  const toggleFollow = () => {
    if (!viewer) onClose();
    follow.toggle();
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
        <button type="button" className={[styles.follow, follow.isActive ? styles.following : ""].join(" ")} aria-pressed={follow.isActive} aria-label={`${follow.isActive ? "Unfollow" : "Follow"} ${person.displayName}`} disabled={follow.isPending} onClick={toggleFollow}>
          {follow.label}
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
