"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";

import { FeedTopicFilterRow, type FeedMode } from "@/components/feed/feedTopicFilterRow";
import { PostCard } from "@/components/feed/postCard";
import { PostFeedSkeleton } from "@/components/feed/postCardSkeleton";
import { RetryButton, InlineLink } from "@/components/ui/controls";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { feedsService } from "@/services/feeds.service";
import type { Post } from "@/types";

import styles from "./home.module.css";
import { AppIcon } from "@/components/ui/appIcon";

function removeDuplicatePosts(posts: readonly Post[]): Post[] {
  const seenPostIds = new Set<string>();
  return posts.filter((post) => {
    if (seenPostIds.has(post.id)) return false;
    seenPostIds.add(post.id);
    return true;
  });
}

function fetchFeedPageForViewer(isGuest: boolean, feedMode: FeedMode, topicId: string | null, cursor: string | null) {
  if (isGuest) return feedsService.fetchPopularFeedPage(cursor);
  return feedMode === "following" ? feedsService.fetchFollowingFeedPage(cursor) : feedsService.fetchForYouFeedPage(topicId, cursor);
}

function FeedSection({ feedMode, topicId, isGuest }: { readonly feedMode: FeedMode; readonly topicId: string | null; readonly isGuest: boolean }) {
  const feedQuery = useInfiniteQuery({
    queryKey: ["feed", isGuest ? "popular" : feedMode, topicId],
    queryFn: ({ pageParam }) => fetchFeedPageForViewer(isGuest, feedMode, topicId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage: feedQuery.hasNextPage,
    isFetchingNextPage: feedQuery.isFetchingNextPage,
    fetchNextPage: feedQuery.fetchNextPage,
  });

  const posts = removeDuplicatePosts((feedQuery.data?.pages ?? []).flatMap((page) => page.data));

  if (feedQuery.isLoading) return <PostFeedSkeleton />;
  if (feedQuery.isError) return <ErrorState description="We couldn't load your feed." action={<RetryButton onRetry={() => feedQuery.refetch()} />} />;
  if (posts.length === 0) {
    return <EmptyState icon={<AppIcon name="sparkle24" size={28} />} title="Your feed is warming up" description="Follow a few people or topics and their posts will show up here." action={<InlineLink href="/explore">Find people to follow</InlineLink>} />;
  }

  return (
    <div className={styles.feedList}>
      {posts.map((post, index) => (
        <PostCard key={post.id} post={post} priority={index < 2} swipeable />
      ))}
      <div ref={sentinelRef} />
      {feedQuery.isFetchingNextPage ? <Spinner label="Loading more posts" /> : null}
      {!feedQuery.hasNextPage ? <p className={styles.feedEnd}>You're all caught up.</p> : null}
    </div>
  );
}

export default function HomePage() {
  const [feedMode, setFeedMode] = useState<FeedMode>("for-you");
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const isGuest = useSession().viewer === null;

  return (
    <div className={styles.page}>
      <h1 className="visuallyHidden">Home feed</h1>
      {isGuest ? (
        <p className={styles.guestNote}>Popular on Zudomart right now. Sign in to get a feed picked for you.</p>
      ) : (
        <FeedTopicFilterRow feedMode={feedMode} activeTopicId={activeTopicId} onSelectMode={setFeedMode} onSelectTopic={setActiveTopicId} />
      )}
      <FeedSection feedMode={feedMode} topicId={activeTopicId} isGuest={isGuest} />
    </div>
  );
}
