"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { PostCard } from "@/components/feed/postCard";
import { PostFeedSkeleton } from "@/components/feed/postCardSkeleton";
import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { BookmarkIcon, ClipsIcon } from "@/components/ui/icons";
import { MediaImage } from "@/components/ui/media";
import { UnderlineTabs } from "@/components/ui/underlineTabs";
import { usersService } from "@/services/users.service";
import type { Post, User } from "@/types";
import { filterPostsForProfileTab, profileContentTabOptions, profileTabEmptyTitle, sortPinnedPostsFirst, type ProfileContentTab } from "@/utils/profileContent.util";

import styles from "./profileContentTabs.module.css";
import { AppIcon } from "@/components/ui/appIcon";

function firstThumbnailOf(post: Post): string | null {
  const first = post.media[0];
  if (!first) return null;
  return first.type === "image" ? first.url : (first.posterUrl ?? null);
}

function MediaGrid({ posts }: { readonly posts: readonly Post[] }) {
  const postsWithMedia = posts.filter((post) => firstThumbnailOf(post));
  if (postsWithMedia.length === 0) return <EmptyState icon={<ClipsIcon size={28} />} title="No photos or videos yet" />;
  return (
    <ul className={styles.mediaGrid}>
      {postsWithMedia.map((post) => (
        <li key={post.id}>
          <Link href={`/post/${post.id}`} className={styles.mediaTile}>
            <MediaImage src={firstThumbnailOf(post)} alt={post.text.slice(0, 80)} sizes="(max-width: 768px) 33vw, 260px" />
            {post.media.length > 1 ? <span className={styles.mediaCount}>{post.media.length}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProfileContentTabs({ user, isSelf }: { readonly user: User; readonly isSelf: boolean }) {
  const [tab, setTab] = useState<ProfileContentTab>("posts");
  const postsQuery = useQuery({ queryKey: ["profile", "posts", user.id], queryFn: () => usersService.fetchPostsByUserId(user.id), retry: false });
  const clipsQuery = useQuery({
    queryKey: ["profile", "clips", user.id],
    queryFn: () => usersService.fetchClipsByUserId(user.id),
    enabled: tab === "clips",
    retry: false,
  });
  const posts = sortPinnedPostsFirst(postsQuery.data?.data ?? []);
  const clips = clipsQuery.data?.data ?? [];
  const panelId = `profile-panel-${user.id}`;
  const visiblePosts = tab === "posts" ? posts : tab === "reposts" ? filterPostsForProfileTab(posts, "reposts") : [];
  const isLoading = tab === "clips" ? clipsQuery.isLoading : postsQuery.isLoading;
  const isError = tab === "clips" ? clipsQuery.isError : postsQuery.isError;
  const refetch = tab === "clips" ? clipsQuery.refetch : postsQuery.refetch;
  const isEmpty = tab === "clips" ? clips.length === 0 : tab === "media" ? posts.length === 0 : visiblePosts.length === 0;

  return (
    <section className={styles.section}>
      <div className={styles.tabRow}>
        <UnderlineTabs label="Profile content" panelId={panelId} value={tab} onChange={setTab} options={profileContentTabOptions} />
        {isSelf ? (
          <Link href="/saved" className={styles.savedLink}>
            <BookmarkIcon size={16} /> Saved
          </Link>
        ) : null}
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-tab-${tab}`}>
        {isLoading ? (
          <PostFeedSkeleton count={2} />
        ) : isError ? (
          <ErrorState description="We couldn't load this section." action={<RetryButton onRetry={() => refetch()} />} />
        ) : isEmpty ? (
          <EmptyState
            icon={tab === "clips" ? <ClipsIcon size={28} /> : <AppIcon name="note24" size={28} />}
            title={profileTabEmptyTitle(tab, isSelf, user.name)}
            description={isSelf && tab !== "media" ? "Share something with your followers from the app." : undefined}
          />
        ) : tab === "media" ? (
          <MediaGrid posts={posts} />
        ) : (
          <div className={styles.postList}>
            {(tab === "clips" ? clips : visiblePosts).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
