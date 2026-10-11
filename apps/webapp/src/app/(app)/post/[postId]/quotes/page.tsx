"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use } from "react";

import { PostCard } from "@/components/feed/postCard";
import { PostCardSkeleton } from "@/components/feed/postCardSkeleton";
import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { postsService } from "@/services/posts.service";

import styles from "../page.module.css";

export default function PostQuotesPage({ params }: { readonly params: Promise<{ readonly postId: string }> }) {
  const { postId } = use(params);
  const router = useRouter();
  const quotesQuery = useInfiniteQuery({
    queryKey: ["feed", "quotes", postId],
    queryFn: ({ pageParam }) => postsService.fetchPostQuotes(postId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const sentinelRef = useInfiniteScrollSentinel({ hasNextPage: quotesQuery.hasNextPage, isFetchingNextPage: quotesQuery.isFetchingNextPage, fetchNextPage: quotesQuery.fetchNextPage });
  const quotes = quotesQuery.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={() => router.back()}>
        <ArrowLeftIcon size={18} /> Back
      </button>
      <h1 className="visuallyHidden">Quotes</h1>
      {quotesQuery.isLoading ? (
        <PostCardSkeleton />
      ) : quotesQuery.isError ? (
        <ErrorState description="Quotes didn't load." action={<RetryButton onRetry={() => quotesQuery.refetch()} />} />
      ) : quotes.length === 0 ? (
        <EmptyState title="No quotes to show" description="Quotes from private accounts or ones you can't see stay hidden." />
      ) : (
        quotes.map((quote) => <PostCard key={quote.id} post={quote} surface="post_detail" />)
      )}
      <div ref={sentinelRef} />
      {quotesQuery.isFetchingNextPage ? <PostCardSkeleton /> : null}
    </div>
  );
}
