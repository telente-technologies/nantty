"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AudiencePanels } from "@/components/analytics/audiencePanels";
import styles from "@/components/analytics/analytics.module.css";
import { TrendChart } from "@/components/analytics/trendChart";
import { useSession } from "@/components/providers/sessionProvider";
import { SegmentedControl } from "@/components/ui/controls";
import { TextField } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader, StatGrid, pageStyles } from "@/components/ui/studioPage";
import { contentService } from "@/services/content.service";
import { creatorService } from "@/services/creator.service";
import { livesService } from "@/services/lives.service";
import type { CreatorEarning } from "@/types/creator.type";
import type { MyPost } from "@/types/audience.type";
import { bucketByDate, isWithinRange, parseCustomRange, rangeForPreset, sumBuckets, toDateInputValue, type DateRange, type RangePreset } from "@/utils/analyticsBuckets.util";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const PRESETS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
] as const;

const MAX_PAGES = 10;

async function fetchUntil<T>(load: (cursor?: string) => Promise<{ data: readonly T[]; nextCursor: string | null }>, dateOf: (item: T) => string, since: Date) {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await load(cursor);
    items.push(...result.data);
    const oldest = result.data.at(-1);
    if (!result.nextCursor || (oldest && new Date(dateOf(oldest)) < since)) return { items, complete: true };
    cursor = result.nextCursor;
  }
  return { items, complete: false };
}

export default function AnalyticsPage() {
  const { viewer } = useSession();
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(rangeForPreset("30d").start));
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()));
  const custom = parseCustomRange(customFrom, customTo);
  const range: DateRange | null = preset === "custom" ? custom.range : rangeForPreset(preset);
  const since = range?.start ?? rangeForPreset("90d").start;
  const sinceKey = toDateInputValue(since);

  const earnings = useQuery({ queryKey: ["analytics", "earnings", sinceKey], queryFn: () => fetchUntil<CreatorEarning>((cursor) => creatorService.listEarnings(cursor), (item) => item.createdAt, since) });
  const posts = useQuery({ queryKey: ["analytics", "posts", viewer?.id, sinceKey], queryFn: () => fetchUntil<MyPost>((cursor) => contentService.listMyPosts(viewer!.id, null, cursor), (item) => item.createdAt, since), enabled: Boolean(viewer?.id) });
  const lives = useQuery({ queryKey: ["lives"], queryFn: () => livesService.listLives() });
  const dashboard = useQuery({ queryKey: ["creator", "dashboard", "all"], queryFn: () => creatorService.fetchDashboard("all") });
  const currency = dashboard.data?.currency ?? earnings.data?.items[0]?.amount.currency ?? "NGN";

  const charts = (() => {
    if (!range) return null;
    const earningItems = (earnings.data?.items ?? []).filter((item) => item.status !== "reversed" && item.amount.currency === currency);
    const liveItems = (lives.data ?? []).filter((live) => live.startedAt !== null);
    const postItems = posts.data?.items ?? [];
    return {
      earnings: bucketByDate(earningItems, range, (item) => item.createdAt, (item) => item.amount.amountMinor),
      lives: bucketByDate(liveItems, range, (live) => live.startedAt, () => 1),
      peakViewers: Math.max(0, ...liveItems.filter((live) => isWithinRange(live.startedAt, range)).map((live) => live.peakViewers)),
      posts: bucketByDate(postItems, range, (post) => post.createdAt, () => 1),
      views: bucketByDate(postItems, range, (post) => post.createdAt, (post) => post.views),
    };
  })();

  const money = (minor: number) => formatMoneyForDisplay({ amountMinor: minor, currency }, { showDecimals: false });
  const count = (value: number) => formatCountWithThousandsSuffix(value);
  const partial = earnings.data?.complete === false || posts.data?.complete === false;

  return (
    <div className={pageStyles.page}>
      <PageHeader title="Analytics" subtitle="Trends for your earnings, lives and posts, plus who follows you. Per-post reach is on each item in Content." />
      <div className={styles.ranges}>
        <SegmentedControl label="Date range" options={PRESETS} value={preset} onChange={setPreset} />
        {preset === "custom" ? (
          <div className={styles.customRange}>
            <TextField label="From" type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} />
            <TextField label="To" type="date" value={customTo} min={customFrom || undefined} max={toDateInputValue(new Date())} onChange={(event) => setCustomTo(event.target.value)} />
          </div>
        ) : null}
      </div>
      {preset === "custom" && custom.error ? <p className={styles.rangeError} role="alert">{custom.error}</p> : null}
      {partial ? <p className={styles.rangeNote}>This range has a lot of activity, so trends show your most recent items only.</p> : null}

      <StatGrid
        label="All-time totals"
        stats={[
          { label: "Followers", value: dashboard.data ? count(dashboard.data.followers.total) : "…" },
          { label: "Total earnings", value: dashboard.data ? formatMoneyForDisplay(dashboard.data.earnings.total, { showDecimals: false }) : "…", hint: "All time" },
          { label: "Coins from fans", value: dashboard.data ? count(dashboard.data.coins.earned) : "…", hint: "All time" },
          { label: "Peak viewers in range", value: charts ? count(charts.peakViewers) : "…" },
        ]}
      />
      {dashboard.isError ? <ErrorState title="Totals didn't load" error={dashboard.error} onRetry={() => void dashboard.refetch()} /> : null}

      {charts ? (
        <div className={styles.charts}>
          {earnings.isError ? <ErrorState title="Earnings didn't load" error={earnings.error} onRetry={() => void earnings.refetch()} /> : earnings.isLoading ? <Skeleton height={240} /> : (
            <TrendChart title="Earnings" total={money(sumBuckets(charts.earnings))} buckets={charts.earnings} formatValue={money} emptyHint="No earnings in this range." />
          )}
          {lives.isError ? <ErrorState title="Lives didn't load" error={lives.error} onRetry={() => void lives.refetch()} /> : lives.isLoading ? <Skeleton height={240} /> : (
            <TrendChart title="Lives streamed" total={count(sumBuckets(charts.lives))} buckets={charts.lives} formatValue={count} emptyHint="No lives in this range." />
          )}
          {posts.isError ? <ErrorState title="Posts didn't load" error={posts.error} onRetry={() => void posts.refetch()} /> : posts.isLoading || !posts.data ? <Skeleton height={240} /> : (
            <>
              <TrendChart title="Posts and clips" total={count(sumBuckets(charts.posts))} buckets={charts.posts} formatValue={count} emptyHint="Nothing posted in this range." />
              <TrendChart title="Views on those posts" total={count(sumBuckets(charts.views))} buckets={charts.views} formatValue={count} emptyHint="No views on posts from this range yet." />
            </>
          )}
        </div>
      ) : null}

      <AudiencePanels viewerId={viewer?.id} />
    </div>
  );
}
