"use client";

import { useState } from "react";
import Link from "next/link";

import { RetryButton } from "@/components/ui/controls";
import { ErrorState, Spinner } from "@/components/ui/feedback";
import { AnalyticsIcon } from "@/components/ui/icons";
import { creatorProgramService } from "@/services/creatorProgram.service";
import { readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { useSession } from "@/components/providers/sessionProvider";
import { EmptyState } from "@/components/ui/feedback";
import { CreatorIcon } from "@/components/ui/icons";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import type { CreatorDashboardPeriod } from "@/types/creator.type";
import { useQuery } from "@tanstack/react-query";

import styles from "./page.module.css";

const PERIODS: readonly { readonly key: CreatorDashboardPeriod; readonly label: string }[] = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

export default function CreatorDashboardPage() {
  const [period, setPeriod] = useState<CreatorDashboardPeriod>("month");
  const { viewer } = useSession();
  const isKnownNonCreator = viewer?.isCreator === false;
  const dashboard = useQuery({
    queryKey: ["creator-dashboard", period],
    queryFn: () => creatorProgramService.fetchCreatorDashboard(period),
    enabled: !isKnownNonCreator,
    retry: false,
  });
  const isNotInCreatorProgram = isKnownNonCreator || (dashboard.error instanceof WebappRequestError && (dashboard.error.status === 403 || dashboard.error.code === "CREATOR_PROGRAM_REQUIRED"));

  if (isNotInCreatorProgram) {
    return (
      <EmptyState
        icon={<CreatorIcon size={28} />}
        title="Join the Creator Program"
        description="Approved creators can go live, earn from gifts and subscriptions, and see their analytics here. Apply in the Zudomart app: Profile, then Creator Program."
      />
    );
  }
  if (dashboard.isLoading) return <Spinner label="Loading your dashboard" />;
  if (dashboard.isError || !dashboard.data) {
    return (
      <ErrorState
        title="Creator dashboard"
        description={readErrorMessageForDisplay(dashboard.error)}
        action={<RetryButton onRetry={() => dashboard.refetch()} />}
      />
    );
  }

  const data = dashboard.data;
  const summary = [
    { label: "Total earnings", value: formatMoneyForDisplay(data.earnings.total) },
    { label: "Available", value: formatMoneyForDisplay(data.availableBalance) },
    { label: "Pending", value: formatMoneyForDisplay(data.pendingBalance) },
    { label: "Followers gained", value: formatCountWithThousandsSuffix(data.followersGained) },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Creator dashboard</h1>
        <div className={styles.filters} role="group" aria-label="Filter dashboard period">
          {PERIODS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={[styles.filter, period === option.key ? styles.filterActive : ""].filter(Boolean).join(" ")}
              aria-pressed={period === option.key}
              onClick={() => setPeriod(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <section className={styles.summary} aria-label="Earnings summary">
        {summary.map((item) => (
          <div key={item.label} className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{item.label}</span>
            <span className={styles.summaryValue}>{item.value}</span>
          </div>
        ))}
      </section>

      <section className={styles.topContent} aria-label="Top lives and posts">
        <h2 className={styles.sectionTitle}>Top lives &amp; posts</h2>
        {data.topContent.length === 0 ? (
          <p className={styles.empty}>Nothing here yet — your best-performing posts will show up with their views.</p>
        ) : (
          <ul className={styles.list}>
            {data.topContent.map((content) => {
              const row = (
                <>
                  <span className={styles.thumb}>
                    {content.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={content.thumbnailUrl} alt="" />
                    ) : null}
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{content.title}</span>
                    <span className={styles.rowMetrics}>
                      <AnalyticsIcon size={14} />
                      {content.kind === "live" ? "Live" : "Post"} · {formatCountWithThousandsSuffix(content.views)} views
                    </span>
                  </span>
                  <span className={styles.rowEarnings}>{formatMoneyForDisplay(content.earnings)}</span>
                </>
              );
              return content.kind === "post" ? (
                <li key={content.id}>
                  <Link href={`/analytics/post/${content.id}`} className={styles.rowLink}>
                    {row}
                  </Link>
                </li>
              ) : (
                <li key={content.id} className={styles.row}>
                  {row}
                </li>
              );
            })}
          </ul>
        )}
        <p className={styles.ownerNote}>
          <AnalyticsIcon size={14} />
          Open a post to see its full analytics — only you can see these numbers.
        </p>
      </section>
    </div>
  );
}
