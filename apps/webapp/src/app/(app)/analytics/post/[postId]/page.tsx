"use client";

import { use } from "react";
import Link from "next/link";

import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { AnalyticsIcon, ArrowLeftIcon } from "@/components/ui/icons";
import { postsService } from "@/services/posts.service";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { analyticsTitleFor, describeAnalyticsFailure, engagementRowsFor, isClipAnalytics, summaryMetricsFor, videoMetricsFor, type AnalyticsRow } from "@/utils/postAnalytics.util";
import { useQuery } from "@tanstack/react-query";

import styles from "./page.module.css";
import { StatGridSkeleton } from "@/components/ui/pageSkeletons";

const DAY_LABELS: readonly string[] = ["S", "M", "T", "W", "T", "F", "S"];

export default function PostAnalyticsPage({ params }: { readonly params: Promise<{ readonly postId: string }> }) {
  const { postId } = use(params);
  const analytics = useQuery({
    queryKey: ["post-analytics", postId],
    queryFn: () => postsService.fetchPostAnalytics(postId),
    retry: (failureCount, error) => describeAnalyticsFailure(error).canRetry && failureCount < 2,
  });

  if (analytics.isLoading) return <StatGridSkeleton label="Loading analytics" />;
  if (analytics.isError || !analytics.data) {
    const failure = describeAnalyticsFailure(analytics.error);
    return <ErrorState error={analytics.error} title={failure.title} description={failure.detail} action={failure.canRetry ? <RetryButton onRetry={() => analytics.refetch()} /> : undefined} />;
  }

  const data = analytics.data;
  const peak = Math.max(1, ...data.daily.map((entry) => entry.impressions));
  const metrics = summaryMetricsFor(data);
  const videoMetrics = videoMetricsFor(data);
  const engagementRows = engagementRowsFor(data);
  const renderMetricGrid = (rows: readonly AnalyticsRow[]) => (
    <div className={styles.grid}>
      {rows.map((metric) => (
        <div className={styles.metric} key={metric.label}>
          <span className={styles.metricValue}>{typeof metric.value === "number" ? formatCountWithThousandsSuffix(metric.value) : metric.value}</span>
          <span className={styles.metricLabel}>{metric.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to feed">
          <ArrowLeftIcon size={20} />
        </Link>
        <h1 className={styles.title}>{analyticsTitleFor(data)}</h1>
      </header>

      <p className={styles.ownerNote}>
        <AnalyticsIcon size={16} />
        Only you can see these numbers.
      </p>

      {renderMetricGrid(metrics)}

      {videoMetrics.length > 0 ? (
        <section className={styles.card} aria-labelledby="video-analytics-title">
          <h2 className={styles.cardTitle} id="video-analytics-title">{isClipAnalytics(data) ? "Watching" : "Video"}</h2>
          {renderMetricGrid(videoMetrics)}
        </section>
      ) : null}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Impressions, last 7 days</h2>
        <div className={styles.chart} role="img" aria-label="Daily impressions for the last seven days">
          {data.daily.map((entry, index) => (
            <div className={styles.chartColumn} key={entry.day}>
              <div className={styles.chartTrack}>
                <div className={styles.chartBar} style={{ height: `${Math.max(4, Math.round((entry.impressions / peak) * 100))}%` }} />
              </div>
              <span className={styles.chartLabel}>{DAY_LABELS[index % DAY_LABELS.length]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Engagement</h2>
        <dl className={styles.engagement}>
          {engagementRows.map((row) => (
            <div className={styles.engagementRow} key={row.label}>
              <dt>{row.label}</dt>
              <dd>{typeof row.value === "number" ? formatCountWithThousandsSuffix(row.value) : row.value}</dd>
            </div>
          ))}
          <div className={styles.engagementRow}>
            <dt>Posted</dt>
            <dd>{formatTimeSincePosted(data.postedAt)} ago</dd>
          </div>
        </dl>
      </section>

      {data.audience.length > 0 ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Audience</h2>
          <dl className={styles.engagement}>
            {data.audience.map((row) => (
              <div className={styles.engagementRow} key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.share}%</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
