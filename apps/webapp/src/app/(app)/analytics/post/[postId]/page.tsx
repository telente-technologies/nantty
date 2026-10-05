"use client";

import { use } from "react";
import Link from "next/link";

import { useSession } from "@/components/providers/sessionProvider";
import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { AnalyticsIcon, ArrowLeftIcon } from "@/components/ui/icons";
import { postsService } from "@/services/posts.service";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { useQuery } from "@tanstack/react-query";

import styles from "./page.module.css";
import { StatGridSkeleton } from "@/components/ui/pageSkeletons";

const DAY_LABELS: readonly string[] = ["S", "M", "T", "W", "T", "F", "S"];

export default function PostAnalyticsPage({ params }: { readonly params: Promise<{ readonly postId: string }> }) {
  const { postId } = use(params);
  const { viewer } = useSession();
  const analytics = useQuery({ queryKey: ["post-analytics", postId], queryFn: () => postsService.fetchPostAnalytics(postId), retry: false });

  if (analytics.isLoading) return <StatGridSkeleton label="Loading analytics" />;
  if (analytics.isError || !analytics.data) {
    return (
      <ErrorState
        title="Analytics unavailable"
        description={analytics.error instanceof Error ? analytics.error.message : "We couldn't load this post's numbers."}
        action={<RetryButton onRetry={() => analytics.refetch()} />}
      />
    );
  }

  const data = analytics.data;
  const isOwner = viewer?.id === data.author.id;
  if (!isOwner) {
    return <ErrorState title="Not available" description="Only the author of a post can see its analytics." action={<RetryButton onRetry={() => analytics.refetch()} />} />;
  }

  const peak = Math.max(1, ...data.daily.map((entry) => entry.impressions));
  const metrics = [
    { label: "Impressions", value: data.impressions },
    { label: "Unique viewers", value: data.uniqueViewers },
    { label: "Profile visits", value: data.profileVisits },
    { label: "Engagements", value: data.engagements },
    { label: "Engagement rate", value: `${data.engagementRate}%` },
    { label: "New follows", value: data.newFollows },
    ...(data.video
      ? [
          { label: "Video views", value: data.video.views },
          { label: "Watch time", value: `${Math.round(data.video.watchTimeSeconds / 60)} min` },
        ]
      : []),
  ];
  const engagementRows = [
    { label: "Likes", value: data.likes },
    { label: "Replies", value: data.comments },
    { label: "Reposts", value: data.reposts },
    { label: "Saves", value: data.saves },
    { label: "Shares", value: data.shares },
    { label: "Link clicks", value: data.linkClicks },
    { label: "Profile clicks", value: data.profileClicks },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to feed">
          <ArrowLeftIcon size={20} />
        </Link>
        <h1 className={styles.title}>Post analytics</h1>
      </header>

      <p className={styles.ownerNote}>
        <AnalyticsIcon size={16} />
        Only you can see these numbers.
      </p>

      <div className={styles.grid}>
        {metrics.map((metric) => (
          <div className={styles.metric} key={metric.label}>
            <span className={styles.metricValue}>{typeof metric.value === "number" ? formatCountWithThousandsSuffix(metric.value) : metric.value}</span>
            <span className={styles.metricLabel}>{metric.label}</span>
          </div>
        ))}
      </div>

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
              <dd>{formatCountWithThousandsSuffix(row.value)}</dd>
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
