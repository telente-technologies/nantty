import { ApiError } from "@/errors/api.error";
import type { PostAnalytics } from "@/types";

import { analyticsTitleFor, describeAnalyticsFailure, engagementRowsFor, formatWatchDuration, videoMetricsFor } from "../postAnalytics.util";

const base: PostAnalytics = {
  postId: "p", kind: "clip", hasLink: false, author: { id: "a", name: "A", username: "a", avatarUrl: null } as never, postedAt: "2026-10-01T00:00:00Z",
  impressions: 100, uniqueViewers: 60, likes: 5, comments: 2, reposts: 1, profileVisits: 3, saves: 1, shares: 1, linkClicks: 0, profileClicks: 3, newFollows: 1,
  engagements: 10, engagementRate: 10, video: { views: 40, watchTimeSeconds: 600, averageWatchSeconds: 15, completedViews: 10, completionRate: 0.25 }, audience: [], daily: [],
};

describe("post analytics presentation", () => {
  it("shows the clip watching section with average time and completion rate", () => {
    expect(analyticsTitleFor(base)).toBe("Clip analytics");
    expect(videoMetricsFor(base)).toEqual([
      { label: "Video views", value: 40 },
      { label: "Watch time", value: "10m" },
      { label: "Average watch time", value: "15s" },
      { label: "Completion rate", value: "25%" },
    ]);
  });

  it("leaves out completion when the data is missing and the video section for text posts", () => {
    expect(videoMetricsFor({ ...base, video: { views: 4, watchTimeSeconds: 30 } }).map((row) => row.label)).toEqual(["Video views", "Watch time", "Average watch time"]);
    expect(videoMetricsFor({ ...base, kind: "post", video: null })).toEqual([]);
  });

  it("hides link clicks for posts without a link and duplicate profile rows", () => {
    const labels = engagementRowsFor(base).map((row) => row.label);
    expect(labels).not.toContain("Link clicks");
    expect(labels).not.toContain("Profile clicks");
    expect(labels).toContain("Comments");
    expect(engagementRowsFor({ ...base, kind: "post", hasLink: true }).map((row) => row.label)).toContain("Link clicks");
  });

  it("formats watch durations", () => {
    expect([0, 59, 60, 61, 3600, 3725].map(formatWatchDuration)).toEqual(["0s", "59s", "1m", "1m 1s", "1h", "1h 2m"]);
  });

  it("gives a friendly, non-retryable state for a non-owner and a retry for failures", () => {
    expect(describeAnalyticsFailure(new ApiError(403, "Only the author", "NOT_POST_OWNER"))).toMatchObject({ title: "These analytics are private", canRetry: false });
    expect(describeAnalyticsFailure(new ApiError(404, "Gone"))).toMatchObject({ canRetry: false });
    expect(describeAnalyticsFailure(new ApiError(500, "Boom"))).toMatchObject({ canRetry: true });
    expect(describeAnalyticsFailure(new TypeError("Network request failed"))).toMatchObject({ canRetry: true });
  });
});
