"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";

import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows, Muted, PageHeader, StatGrid, pageStyles } from "@/components/ui/studioPage";
import { webappLinks } from "@/config/webappLinks.config";
import { isNotFoundError, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { contentService } from "@/services/content.service";
import type { PostAnalytics } from "@/types/audience.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

const percent = (share: number) => `${Math.round(share * 1000) / 10}%`;
const minutesAndSeconds = (seconds: number) => (seconds < 60 ? `${Math.round(seconds)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`);
const hours = (seconds: number) => (seconds < 3600 ? minutesAndSeconds(seconds) : `${Math.round((seconds / 3600) * 10) / 10}h`);

function suggestNextStep(analytics: PostAnalytics): string {
  if (analytics.video && analytics.video.views > 50 && analytics.video.completionRate < 0.25) return "Most viewers leave before the end. Try a shorter cut or put the payoff in the first 3 seconds.";
  if (analytics.impressions > 100 && analytics.engagementRate < 0.02) return "Few viewers react. End with a question to get comments.";
  if (analytics.audience[0] && analytics.audience[0].share > 0.8) return "Mostly followers saw this. Use trending topics or a sound to reach new people.";
  return "This is performing in line with your other content. Post again while your audience is active.";
}

export default function PostAnalyticsPage({ params }: { readonly params: Promise<{ readonly postId: string }> }) {
  const { postId } = use(params);
  const analytics = useQuery({ queryKey: ["post-analytics", postId], queryFn: () => contentService.fetchPostAnalytics(postId) });

  if (analytics.isError) {
    const description = isNotFoundError(analytics.error) ? "This post was deleted or isn't yours." : readErrorMessageForDisplay(analytics.error);
    return <ErrorState title="Analytics didn't load" description={description} action={<Link href="/content">Back to content</Link>} onRetry={isNotFoundError(analytics.error) ? undefined : () => void analytics.refetch()} />;
  }
  if (!analytics.data) return <Skeleton height={320} />;
  const data = analytics.data;
  const maxDaily = Math.max(1, ...data.daily.map((day) => day.impressions));

  return (
    <div className={pageStyles.page}>
      <Link href="/content" className={pageStyles.textLink}>All content</Link>
      <PageHeader
        title={data.kind === "clip" ? "Clip analytics" : "Post analytics"}
        subtitle={`Posted ${new Date(data.postedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
        action={<a className={pageStyles.textLink} href={webappLinks.post(data.postId)} target="_blank" rel="noopener noreferrer">Open post</a>}
      />
      <Card title="What to try next"><Muted>{suggestNextStep(data)}</Muted></Card>
      <StatGrid
        label="Reach"
        stats={[
          { label: "Views", value: formatCountWithThousandsSuffix(data.impressions) },
          { label: "Unique viewers", value: formatCountWithThousandsSuffix(data.uniqueViewers) },
          { label: "Engagement rate", value: percent(data.engagementRate), hint: `${formatCountWithThousandsSuffix(data.engagements)} engagements` },
          { label: "New followers", value: formatCountWithThousandsSuffix(data.newFollows) },
          { label: "Profile visits", value: formatCountWithThousandsSuffix(data.profileVisits) },
        ]}
      />
      {data.video ? (
        <StatGrid
          label="Video"
          stats={[
            { label: "Video views", value: formatCountWithThousandsSuffix(data.video.views) },
            { label: "Watch time", value: hours(data.video.watchTimeSeconds) },
            { label: "Average watch", value: minutesAndSeconds(data.video.averageWatchSeconds) },
            { label: "Watched to the end", value: percent(data.video.completionRate), hint: `${formatCountWithThousandsSuffix(data.video.completedViews)} full views` },
          ]}
        />
      ) : null}
      <div className={pageStyles.columns}>
        <Card title="Engagement">
          <DataRows rows={[["Likes", data.likes], ["Comments", data.comments], ["Reposts", data.reposts], ["Shares", data.shares], ["Saves", data.saves], ["Link clicks", data.linkClicks]].map(([label, value]) => ({ key: String(label), label, value: formatCountWithThousandsSuffix(Number(value)) }))} />
        </Card>
        <Card title="Views, last 7 days">
          <DataRows rows={data.daily.map((day) => ({ key: day.day, label: new Date(`${day.day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }), value: <span><meter min={0} max={maxDaily} value={day.impressions} aria-hidden="true" /> {formatCountWithThousandsSuffix(day.impressions)}</span> }))} />
        </Card>
        <Card title="Who saw it">
          {data.audience.length === 0 ? <Muted>No signed-in viewers yet.</Muted> : <DataRows rows={data.audience.map((slice) => ({ key: slice.label, label: slice.label, value: percent(slice.share) }))} />}
        </Card>
      </div>
    </div>
  );
}
