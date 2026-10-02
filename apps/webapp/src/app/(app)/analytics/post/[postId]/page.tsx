"use client";

import { use } from "react";
import Link from "next/link";

import { useSession } from "@/components/providers/sessionProvider";
import { RetryButton } from "@/components/ui/controls";
import { ErrorState, Spinner } from "@/components/ui/feedback";
import { AnalyticsIcon, ArrowLeftIcon } from "@/components/ui/icons";
import { postsService } from "@/services/posts.service";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { useQuery } from "@tanstack/react-query";

import styles from "./page.module.css";

const DAY_LABELS: readonly string[] = ["S", "M", "T", "W", "T", "F", "S"];

export default function PostAnalyticsPage({ params }: { readonly params: Promise<{ readonly postId: string }> }) {
  const { postId } = use(params);
  const { viewer } = useSession();
  const analytics = useQuery({ queryKey: ["post-analytics", postId], queryFn: () => postsService.fetchPostAnalytics(postId), retry: false });

  if (analytics.isLoading) return <Spinner label="Loading analytics" />;
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
    { label: "Reposts", value: data.reposts },
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
            <span className={styles.metricValue}>{formatCountWithThousandsSuffix(metric.value)}</span>
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
          <div className={styles.engagementRow}>
            <dt>Likes</dt>
            <dd>{formatCountWithThousandsSuffix(data.likes)}</dd>
          </div>
          <div className={styles.engagementRow}>
            <dt>Comments</dt>
            <dd>{formatCountWithThousandsSuffix(data.comments)}</dd>
          </div>
          <div className={styles.engagementRow}>
            <dt>Reposts</dt>
            <dd>{formatCountWithThousandsSuffix(data.reposts)}</dd>
          </div>
          <div className={styles.engagementRow}>
            <dt>Posted</dt>
            <dd>{formatTimeSincePosted(data.postedAt)} ago</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
