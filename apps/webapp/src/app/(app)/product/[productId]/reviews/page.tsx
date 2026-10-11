"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

import { ReviewCard } from "@/components/reviews/reviewCard";
import { StarRatingDisplay } from "@/components/reviews/starRating";
import styles from "@/components/reviews/reviews.module.css";
import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { reviewsService } from "@/services/reviews.service";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { ratingBreakdown } from "@/utils/productReviews.util";

export default function ProductReviewsPage({ params }: { readonly params: Promise<{ readonly productId: string }> }) {
  const { productId } = use(params);
  const router = useRouter();
  const summary = useQuery({ queryKey: ["product", productId, "ratingSummary"], queryFn: () => reviewsService.fetchRatingSummary(productId), retry: false });
  const reviews = useInfiniteQuery({
    queryKey: ["product", productId, "reviews"],
    queryFn: ({ pageParam }) => reviewsService.fetchProductReviews(productId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const sentinelRef = useInfiniteScrollSentinel({ hasNextPage: reviews.hasNextPage && !reviews.isError, isFetchingNextPage: reviews.isFetchingNextPage, fetchNextPage: reviews.fetchNextPage });
  const firstPage = reviews.data?.pages[0];
  const items = reviews.data?.pages.flatMap((page) => page.reviews) ?? [];
  const average = summary.data?.average ?? firstPage?.average ?? 0;
  const count = summary.data?.count ?? firstPage?.count ?? 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} aria-label="Back" onClick={() => router.back()}><ArrowLeftIcon size={18} /></button>
        <h1 className={styles.title}>Ratings and reviews</h1>
      </header>
      {reviews.isPending ? (
        <div className={styles.list} aria-hidden="true">{[0, 1, 2].map((index) => <Skeleton key={index} height={96} />)}</div>
      ) : reviews.isError && !firstPage ? (
        <ErrorState description="Couldn't load reviews." error={reviews.error} onRetry={() => void reviews.refetch()} />
      ) : (
        <>
          <section className={styles.summary} aria-label="Rating summary">
            <div className={styles.average}>
              <strong>{count > 0 ? average.toFixed(1) : "New"}</strong>
              <StarRatingDisplay rating={average} />
              <span>{formatCountWithThousandsSuffix(count)} {count === 1 ? "review" : "reviews"}</span>
            </div>
            {summary.data ? (
              <ul className={styles.breakdown}>
                {ratingBreakdown(summary.data).map((row) => (
                  <li key={row.star} className={styles.breakdownRow}>
                    <span>{row.star}</span>
                    <span className={styles.bar} aria-hidden="true"><span className={styles.barFill} style={{ width: `${Math.round(row.share * 100)}%` }} /></span>
                    <span aria-label={`${row.count} ${row.star}-star reviews`}>{row.count}</span>
                  </li>
                ))}
              </ul>
            ) : <span />}
          </section>
          {items.length === 0 ? (
            <EmptyState kind="reviews" title="No reviews yet" description="Buyers can review this product once their order is delivered." action={<Link href={`/product/${encodeURIComponent(productId)}`}>Back to product</Link>} />
          ) : (
            <div className={styles.list}>
              {items.map((review) => <ReviewCard key={review.id} review={review} />)}
            </div>
          )}
          <div ref={sentinelRef} />
          {reviews.isFetchNextPageError ? <RetryButton onRetry={() => reviews.fetchNextPage()} /> : null}
        </>
      )}
    </div>
  );
}
