"use client";

import { formatMonthKeyAsLongLabel, formatMonthKeyAsShortLabel } from "@/components/customers/customerPresentation.util";
import { HorizontalBarList } from "@/components/charts/horizontalBarList";
import { LineChart } from "@/components/charts/lineChart";
import { StarRating } from "@/components/reviews/reviewCard";
import { Panel } from "@/components/ui/panel";
import type { ReviewsSummary } from "@/types/review.type";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./reviews.module.css";

export function ReviewsSummaryPanel({ summary, locale }: { readonly summary: ReviewsSummary; readonly locale: string }) {
  const averageRating = summary.averageRatingHundredths / 100;
  const ratingsWithData = summary.trend.filter((point) => point.reviewCount > 0);
  return (
    <div className={styles.summaryGrid}>
      <Panel title="Reputation">
        <div className={styles.stack}>
          <p className={styles.bigRating}>{averageRating.toFixed(1)}</p>
          <p className={styles.stars} aria-hidden="true"><StarRating rating={averageRating} /></p>
          <p className={styles.muted}>{summary.totalReviews.toLocaleString(locale)} reviews · {summary.productReviews} product · {summary.storeReviews} store</p>
          <p className={styles.muted}>You replied to {formatBasisPointsAsPercent(summary.responseRateBasisPoints)} · {summary.unansweredCount} waiting for a reply</p>
          <HorizontalBarList
            title="Rating distribution"
            colorVariable="--caution"
            items={(["5", "4", "3", "2", "1"] as const).map((stars) => ({ key: stars, label: `${stars} star${stars === "1" ? "" : "s"}`, value: summary.distribution[stars], displayValue: summary.distribution[stars].toLocaleString(locale) }))}
          />
        </div>
      </Panel>
      <Panel title="Rating trend" description="Average rating and number of reviews per month, last 6 months">
        {ratingsWithData.length > 1 ? (
          <LineChart
            title="Average rating per month"
            description="A line showing the average star rating each month."
            series={[{ key: "rating", label: "Average rating", colorVariable: "--caution" }]}
            points={summary.trend.map((point) => ({ label: `${formatMonthKeyAsLongLabel(point.month, locale)} · ${point.reviewCount} reviews`, shortLabel: formatMonthKeyAsShortLabel(point.month, locale), values: { rating: point.averageRatingHundredths } }))}
            formatValue={(value) => `${(value / 100).toFixed(2)} stars`}
            formatAxisValue={(value) => (value / 100).toFixed(1)}
            height={220}
          />
        ) : (
          <p className={styles.muted}>Not enough reviews yet to show a trend.</p>
        )}
      </Panel>
    </div>
  );
}
