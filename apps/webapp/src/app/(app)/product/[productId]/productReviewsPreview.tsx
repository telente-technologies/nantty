"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ReviewCard } from "@/components/reviews/reviewCard";
import { StarRatingDisplay } from "@/components/reviews/starRating";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { reviewsService } from "@/services/reviews.service";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { ratingBreakdown, resolveReviewPreviewMetrics } from "@/utils/productReviews.util";

import styles from "./productReviewsPreview.module.css";

export function ProductReviewsPreview({ productId }: { readonly productId: string }) {
  const reviews = useQuery({
    queryKey: ["products", "reviews", productId, "preview"],
    queryFn: () => reviewsService.fetchProductReviews(productId, null, 3),
    retry: false,
  });
  const summary = useQuery({
    queryKey: ["product", productId, "ratingSummary"],
    queryFn: () => reviewsService.fetchRatingSummary(productId),
    retry: false,
  });
  const href = `/product/${encodeURIComponent(productId)}/reviews`;
  // Keep the rating visible when the paginated preview fails independently.
  const { count, average } = resolveReviewPreviewMetrics(summary.data, reviews.data);

  return (
    <section className={styles.section} aria-labelledby="product-reviews-title">
      <header className={styles.header}>
        <div>
          <h2 id="product-reviews-title" className={styles.title}>Ratings &amp; reviews</h2>
          {count > 0 && (summary.data || reviews.data) ? (
            <div className={styles.rating}>
              <strong>{average.toFixed(1)}</strong>
              <StarRatingDisplay rating={average} />
              <span>{formatCountWithThousandsSuffix(count)} {count === 1 ? "review" : "reviews"}</span>
            </div>
          ) : null}
        </div>
        {count > 0 ? <Link href={href} className={styles.seeAll}>See all</Link> : null}
      </header>

      {reviews.isPending ? (
        <div className={styles.loading} aria-label="Loading product reviews" role="status">
          {[0, 1].map((index) => <Skeleton key={index} height={112} />)}
        </div>
      ) : reviews.isError && !reviews.data ? (
        <ErrorState description="Couldn't load reviews." error={reviews.error} onRetry={() => void reviews.refetch()} />
      ) : count === 0 ? (
        <p className={styles.empty}>No reviews yet. Buyers can rate this product after it’s delivered.</p>
      ) : (
        <>
          {summary.data ? (
            <ul className={styles.breakdown} aria-label="Review rating breakdown">
              {ratingBreakdown(summary.data).map((row) => (
                <li key={row.star} className={styles.breakdownRow} aria-label={`${row.star} stars: ${row.count} ${row.count === 1 ? "review" : "reviews"}`}>
                  <span>{row.star}</span>
                  <span className={styles.bar} aria-hidden="true"><span className={styles.barFill} style={{ width: `${Math.round(row.share * 100)}%` }} /></span>
                  <span>{row.count}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className={styles.reviewList}>
            {reviews.data?.reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
          </div>
        </>
      )}
    </section>
  );
}
