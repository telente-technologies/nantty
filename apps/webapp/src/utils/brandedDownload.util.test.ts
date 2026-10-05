import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Post, PostMediaDownload } from "@/types";

import { findDownloadTargetForPost, pollUntilBrandedDownloadIsReady } from "./brandedDownload.util";

const basePost = { id: "p1", sponsored: null, media: [{ id: "m1", type: "video", url: "https://cdn/v.mp4", status: "ready" }] } as unknown as Post;

describe("branded downloads", () => {
  it("offers the first ready media unless the creator turned downloads off", () => {
    assert.deepEqual(findDownloadTargetForPost(basePost), { postId: "p1", mediaId: "m1", mediaType: "video" });
    assert.equal(findDownloadTargetForPost({ ...basePost, viewerCanDownload: false }), null);
    assert.equal(findDownloadTargetForPost({ ...basePost, media: [{ type: "image", url: "x" }] }), null);
  });

  it("polls with the server's pacing until a signed link is ready", async () => {
    const responses: PostMediaDownload[] = [{ status: "processing", progress: 0.2, retryAfterMs: 5 }, { status: "ready", progress: 1, url: "https://signed/x.mp4" }];
    const progress: number[] = [];
    const ready = await pollUntilBrandedDownloadIsReady({ requestDownload: async () => responses.shift() as PostMediaDownload, onProgress: (value) => progress.push(value), waitMilliseconds: async () => undefined });
    assert.equal(ready.url, "https://signed/x.mp4");
    assert.deepEqual(progress, [0.2]);
  });
});
