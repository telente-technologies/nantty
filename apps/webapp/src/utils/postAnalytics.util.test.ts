import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WebappRequestError } from "@/services/clientApi.service";
import type { PostAnalytics } from "@/types";

import { analyticsTitleFor, describeAnalyticsFailure, engagementRowsFor, videoMetricsFor } from "./postAnalytics.util";

const clip = {
  postId: "c", kind: "clip", hasLink: false, author: { id: "a", name: "A", username: "a", avatarUrl: null }, postedAt: "2026-10-01T00:00:00Z", impressions: 10, uniqueViewers: 5,
  likes: 1, comments: 1, reposts: 0, profileVisits: 1, saves: 0, shares: 0, linkClicks: 0, profileClicks: 1, newFollows: 0, engagements: 3, engagementRate: 30,
  video: { views: 4, watchTimeSeconds: 90, averageWatchSeconds: 22.5, completedViews: 1, completionRate: 0.25 }, audience: [], daily: [],
} as unknown as PostAnalytics;

describe("post analytics presentation", () => {
  it("shows the clip watching numbers and hides rows that do not apply", () => {
    assert.equal(analyticsTitleFor(clip), "Clip analytics");
    assert.deepEqual(videoMetricsFor(clip).map((row) => row.value), [4, "1m 30s", "23s", "25%"]);
    assert.equal(engagementRowsFor(clip).some((row) => row.label === "Link clicks" || row.label === "Profile clicks"), false);
  });

  it("explains a non-owner deep link without offering a pointless retry", () => {
    assert.deepEqual(describeAnalyticsFailure(new WebappRequestError(403, "NOT_POST_OWNER", "Only the author")), { title: "These analytics are private", detail: "Only the author can see analytics for this post.", canRetry: false });
    assert.equal(describeAnalyticsFailure(new WebappRequestError(0, "NETWORK_UNAVAILABLE", "Offline")).canRetry, true);
    assert.equal(describeAnalyticsFailure(new WebappRequestError(502, "BAD_GATEWAY", "Down")).canRetry, true);
  });
});
