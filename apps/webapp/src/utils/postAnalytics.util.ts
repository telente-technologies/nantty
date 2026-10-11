import { WebappRequestError } from "@/services/clientApi.service";
import type { PostAnalytics } from "@/types";

export interface AnalyticsRow {
  readonly label: string;
  readonly value: number | string;
}

export function formatWatchDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const remainder = seconds % 60;
    return remainder === 0 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 60)}m ${remainder}s`;
  }
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes === 0 ? `${Math.floor(seconds / 3600)}h` : `${Math.floor(seconds / 3600)}h ${minutes}m`;
}

export const isClipAnalytics = (data: PostAnalytics) => data.kind === "clip";

export function analyticsTitleFor(data: PostAnalytics | undefined): string {
  return data && isClipAnalytics(data) ? "Clip analytics" : "Post analytics";
}

export function summaryMetricsFor(data: PostAnalytics): readonly AnalyticsRow[] {
  return [
    { label: "Impressions", value: data.impressions },
    { label: "Unique viewers", value: data.uniqueViewers },
    { label: "Profile visits", value: data.profileVisits },
    { label: "Engagements", value: data.engagements },
    { label: "Engagement rate", value: `${data.engagementRate}%` },
    { label: "New follows", value: data.newFollows },
  ];
}

export function videoMetricsFor(data: PostAnalytics): readonly AnalyticsRow[] {
  const video = data.video;
  if (!video) return [];
  const averageWatchSeconds = video.averageWatchSeconds ?? (video.views > 0 ? video.watchTimeSeconds / video.views : 0);
  return [
    { label: "Video views", value: video.views },
    { label: "Watch time", value: formatWatchDuration(video.watchTimeSeconds) },
    { label: "Average watch time", value: formatWatchDuration(averageWatchSeconds) },
    ...(video.completionRate !== undefined && video.views > 0 ? [{ label: "Completion rate", value: `${Math.round(video.completionRate * 100)}%` }] : []),
  ];
}

export function engagementRowsFor(data: PostAnalytics): readonly AnalyticsRow[] {
  const showLinkClicks = data.hasLink === true || data.linkClicks > 0;
  return [
    { label: "Likes", value: data.likes },
    { label: isClipAnalytics(data) ? "Comments" : "Replies", value: data.comments },
    { label: "Reposts", value: data.reposts },
    { label: "Saves", value: data.saves },
    { label: "Shares", value: data.shares },
    ...(showLinkClicks ? [{ label: "Link clicks", value: data.linkClicks }] : []),
  ];
}

export interface AnalyticsFailure {
  readonly title: string;
  readonly detail: string;
  readonly canRetry: boolean;
}

export function describeAnalyticsFailure(error: unknown): AnalyticsFailure {
  if (error instanceof WebappRequestError && error.status === 401) return { title: "Sign in to see analytics", detail: "Analytics are only shown to the post's author.", canRetry: false };
  if (error instanceof WebappRequestError && error.status === 403) {
    return { title: "These analytics are private", detail: "Only the author can see analytics for this post.", canRetry: false };
  }
  if (error instanceof WebappRequestError && error.status === 404) return { title: "This post isn't available", detail: "It may have been deleted.", canRetry: false };
  return { title: "Couldn't load analytics", detail: "Check your connection and try again.", canRetry: true };
}
