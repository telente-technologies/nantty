"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";

import { MartBrowser } from "@/components/commerce/martBrowser";
import { FeedTopicFilterRow, type FeedMode } from "@/components/feed/feedTopicFilterRow";
import { HomeSectionPager } from "@/components/home/homeSectionPager";
import { FeedPostsWithModules } from "@/components/feedModules/feedPostsWithModules";
import { PostFeedSkeleton } from "@/components/feed/postCardSkeleton";
import { InlineLink } from "@/components/ui/controls";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { feedsService } from "@/services/feeds.service";
import type { Post } from "@/types";

import styles from "./home.module.css";

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

  if (feedQuery.isLoading) return <div className={styles.feedList}><PostFeedSkeleton /></div>;
  if (feedQuery.isError) return <div className={styles.feedList}><ErrorState description="We couldn't load your feed." error={feedQuery.error} onRetry={() => void feedQuery.refetch()} /></div>;
  if (posts.length === 0) {
    return <div className={styles.feedList}><EmptyState kind="feed" title="Your feed is warming up" description="Follow a few people or topics and their posts will show up here." action={<InlineLink href="/explore">Find people to follow</InlineLink>} /></div>;
  }

  return (
    <div className={styles.feedList}>
      <FeedPostsWithModules posts={posts} isForYouFeed={isGuest || feedMode === "for-you"} />
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

  const feed = (
    <div className={styles.page}>
      {isGuest ? (
        <p className={styles.guestNote}>Popular on Nantty right now. Sign in to get a feed picked for you.</p>
      ) : (
        <FeedTopicFilterRow feedMode={feedMode} activeTopicId={activeTopicId} onSelectMode={setFeedMode} onSelectTopic={setActiveTopicId} />
      )}
      <FeedSection feedMode={feedMode} topicId={activeTopicId} isGuest={isGuest} />
    </div>
  );

  return (
    <>
      <h1 className="visuallyHidden">Home</h1>
      <HomeSectionPager feed={feed} mart={<MartBrowser />} />
    </>
  );
}
