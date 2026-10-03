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

import styles from "./profileContentTabs.module.css";
import { AppIcon } from "@/components/ui/appIcon";

type ProfileTab = "posts" | "media";

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
  const [tab, setTab] = useState<ProfileTab>("posts");
  const postsQuery = useQuery({ queryKey: ["profile", "posts", user.id], queryFn: () => usersService.fetchPostsByUserId(user.id), retry: false });
  const posts = postsQuery.data?.data ?? [];
  const panelId = `profile-panel-${user.id}`;

  return (
    <section className={styles.section}>
      <div className={styles.tabRow}>
        <UnderlineTabs
          label="Profile content"
          panelId={panelId}
          value={tab}
          onChange={setTab}
          options={[
            { value: "posts", label: "Posts" },
            { value: "media", label: "Media" },
          ]}
        />
        {isSelf ? (
          <Link href="/saved" className={styles.savedLink}>
            <BookmarkIcon size={16} /> Saved
          </Link>
        ) : null}
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-tab-${tab}`}>
        {postsQuery.isLoading ? (
          <PostFeedSkeleton count={2} />
        ) : postsQuery.isError ? (
          <ErrorState description="We couldn't load these posts." action={<RetryButton onRetry={() => postsQuery.refetch()} />} />
        ) : posts.length === 0 ? (
          <EmptyState icon={<AppIcon name="note24" size={28} />} title="No posts yet" description={isSelf ? "Share something with your followers from the app." : `${user.name} hasn't posted yet.`} />
        ) : tab === "media" ? (
          <MediaGrid posts={posts} />
        ) : (
          <div className={styles.postList}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
