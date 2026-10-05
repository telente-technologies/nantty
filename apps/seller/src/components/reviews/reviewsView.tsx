"use client";

import { useState } from "react";

import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { ReviewCard } from "@/components/reviews/reviewCard";
import { ReviewsSummaryPanel } from "@/components/reviews/reviewsSummaryPanel";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { SelectField } from "@/components/ui/formFields";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Review, ReviewKind, ReviewsSummary } from "@/types/review.type";

import styles from "./reviews.module.css";

type ReviewSort = "newest" | "oldest" | "lowest" | "highest" | "helpful";

export function ReviewsView() {
  const { locale } = useMoneyFormatter();
  const [kindFilter, setKindFilter] = useState<ReviewKind | "all">("all");
  const [ratingFilter, setRatingFilter] = useState("");
  const [repliedFilter, setRepliedFilter] = useState("");
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [searchText, setSearchText] = useState("");
  const [changedReviews, setChangedReviews] = useState<Record<string, Review>>({});
  const summaryQuery = useSellerQuery<ReviewsSummary>("/seller/reviews/summary");
  const reviewsList = useCommerceCursorList<Review>("/seller/reviews", { kind: kindFilter, rating: ratingFilter, replied: repliedFilter, sort, q: searchText, limit: 10 });

  function rememberChangedReview(review: Review) {
    setChangedReviews((current) => ({ ...current, [review.id]: review }));
    summaryQuery.reload();
  }

  return (
    <PageStack>
      <PageHeader title="Reviews" description="What buyers say about your products and your store in the Zudomart app. Reply publicly, and report reviews that break the rules." />
      {summaryQuery.data ? <ReviewsSummaryPanel summary={summaryQuery.data} locale={locale} /> : summaryQuery.isLoading ? <LoadingBlock label="Loading your rating" /> : null}
      {summaryQuery.errorMessage ? <ErrorCallout message={summaryQuery.errorMessage} onRetry={summaryQuery.reload} /> : null}
      <SegmentedControl label="Review type" value={kindFilter} onValueChange={setKindFilter} options={[{ value: "all", label: "All reviews" }, { value: "product", label: "Products" }, { value: "store", label: "Store" }]} />
      <FilterBar>
        <SearchInput label="Search reviews" placeholder="Words, buyer, product or order" value={searchText} onValueChange={setSearchText} />
        <SelectField label="Stars" hideLabel value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} options={[{ value: "", label: "Any rating" }, ...[5, 4, 3, 2, 1].map((stars) => ({ value: String(stars), label: `${stars} star${stars === 1 ? "" : "s"}` }))]} />
        <SelectField label="Reply" hideLabel value={repliedFilter} onChange={(event) => setRepliedFilter(event.target.value)} options={[{ value: "", label: "Replied or not" }, { value: "no", label: "Needs a reply" }, { value: "yes", label: "Replied" }]} />
        <SelectField label="Sort" hideLabel value={sort} onChange={(event) => setSort(event.target.value as ReviewSort)} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "lowest", label: "Lowest rating" }, { value: "highest", label: "Highest rating" }, { value: "helpful", label: "Most helpful" }]} />
      </FilterBar>
      {reviewsList.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={reviewsList.reload}>Try again</Button>}>{reviewsList.errorMessage}</Callout> : null}
      {reviewsList.isLoading && reviewsList.items.length === 0 ? <LoadingBlock label="Loading reviews" /> : null}
      {!reviewsList.isLoading && !reviewsList.errorMessage && reviewsList.items.length === 0 ? <EmptyState iconName="star16" title="No reviews match" description="Buyers can review a product after delivery. Try a different filter." /> : null}
      <div className={styles.list}>
        {reviewsList.items.map((review) => {
          const latest = changedReviews[review.id] ?? review;
          return <ReviewCard key={review.id} review={latest} onReviewChanged={rememberChangedReview} />;
        })}
      </div>
      {reviewsList.hasMore ? <div><Button onClick={reviewsList.loadMore} isBusy={reviewsList.isLoadingMore}>Show more reviews</Button></div> : null}
    </PageStack>
  );
}
