import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { advanceClipWatchSession, createClipWatchSession, summarizeClipWatchSession } from "./clipWatchSession.util";
import { createFeedInteractionQueue, outcomeForStatus, retryDelayAfterFailures, sanitizeFeedInteraction, type FeedInteraction, type SendOutcome } from "./feedInteractionQueue.util";
import { advanceImpressionSession, createImpressionSession } from "./impressionSession.util";

function harness(outcomes: SendOutcome[] = [], stored: unknown[] = []) {
  const sent: (readonly FeedInteraction[])[] = [];
  const keepalives: boolean[] = [];
  let saved: readonly unknown[] = stored;
  let online = true;
  const scheduled: { callback: () => void; delayMs: number }[] = [];
  const queue = createFeedInteractionQueue({
    send: async (events, options) => {
      sent.push(events);
      keepalives.push(options.keepalive);
      return outcomes.shift() ?? "sent";
    },
    load: () => saved,
    save: (events) => {
      saved = events;
    },
    isOnline: () => online,
    schedule: (callback, delayMs) => {
      const entry = { callback, delayMs };
      scheduled.push(entry);
      return () => scheduled.splice(scheduled.indexOf(entry), 1);
    },
  });
  return { queue, sent, keepalives, scheduled, saved: () => saved, goOffline: () => { online = false; }, goOnline: () => { online = true; } };
}

const target = { postId: "post-1", authorId: "author-1" };

describe("feed interaction queue", () => {
  it("records nothing for guests or for the viewer's own posts", () => {
    const { queue } = harness();
    assert.equal(queue.recordViewOncePerSession(target, "feed"), false);
    queue.setViewer("author-1");
    queue.recordProfileClick(target, "feed");
    assert.equal(queue.pendingCount(), 0);
  });

  it("dedupes views per surface for the session and batches them", async () => {
    const { queue, sent } = harness();
    queue.setViewer("viewer-1");
    assert.equal(queue.recordViewOncePerSession(target, "feed", 2), true);
    assert.equal(queue.recordViewOncePerSession(target, "feed", 2), false);
    assert.equal(queue.recordViewOncePerSession(target, "clips"), true);
    await queue.flush();
    assert.deepEqual(sent, [[{ postId: "post-1", kind: "view", surface: "feed", position: 2 }, { postId: "post-1", kind: "view", surface: "clips" }]]);
    assert.equal(queue.pendingCount(), 0);
  });

  it("keeps events on 429 or network failure and backs off, but drops on other 4xx", async () => {
    const { queue, scheduled } = harness(["retry", "rejected"]);
    queue.setViewer("viewer-1");
    queue.recordFollow(target, "clips");
    await queue.flush();
    assert.equal(queue.pendingCount(), 1);
    assert.equal(scheduled.at(-1)?.delayMs, 4000);
    await queue.flush();
    assert.equal(queue.pendingCount(), 0);
    assert.equal(outcomeForStatus(429), "retry");
    assert.equal(outcomeForStatus(503), "retry");
    assert.equal(outcomeForStatus(400), "rejected");
    assert.equal(outcomeForStatus(204), "sent");
    assert.equal(retryDelayAfterFailures(30), 300_000);
  });

  it("holds events while offline and sends them with keepalive when the page is hidden", async () => {
    const { queue, sent, keepalives, goOnline, goOffline } = harness();
    queue.setViewer("viewer-1");
    goOffline();
    queue.recordLinkClick(target, "post_detail");
    await queue.flush();
    assert.equal(sent.length, 0);
    goOnline();
    await queue.flushBeforeUnload();
    assert.deepEqual(keepalives, [true]);
  });

  it("resumes events saved before the tab closed, only for the same account", async () => {
    const stored = [{ postId: "post-1", kind: "view", surface: "feed", accountId: "viewer-1" }, { postId: "post-2", kind: "view", surface: "feed", accountId: "someone-else" }, "garbage"];
    const { queue, sent } = harness([], stored);
    queue.setViewer("viewer-1");
    await queue.flush();
    assert.deepEqual(sent, [[{ postId: "post-1", kind: "view", surface: "feed" }]]);
  });

  it("forgets queued events when the viewer signs out", () => {
    const { queue } = harness();
    queue.setViewer("viewer-1");
    queue.recordFollow(target, "feed");
    queue.setViewer(null);
    assert.equal(queue.pendingCount(), 0);
  });

  it("clamps absurd values before they can poison a batch", () => {
    assert.deepEqual(sanitizeFeedInteraction({ postId: "p", kind: "watch", surface: "clips", watchMs: 1e15, durationMs: Number.NaN, loopCount: -3, watchFraction: 4 }), {
      postId: "p", kind: "watch", surface: "clips", watchMs: 3_600_000, durationMs: 0, loopCount: 0, watchFraction: 1,
    });
  });

  it("caps a batch at fifty events", async () => {
    const { queue, sent } = harness();
    queue.setViewer("viewer-1");
    for (let index = 0; index < 120; index += 1) queue.recordDwell({ postId: `post-${index}`, authorId: "author-1" }, "feed", 1000);
    await queue.flush();
    assert.deepEqual(sent.map((batch) => batch.length).filter((size) => size > 0).every((size) => size <= 50), true);
    assert.equal(queue.pendingCount(), 0);
  });
});

describe("impressions and clip watching", () => {
  it("ignores a fast scroll and counts a one second look", () => {
    const fast = createImpressionSession();
    advanceImpressionSession(fast, 1, 0);
    assert.equal(advanceImpressionSession(fast, 0, 500), null);
    const look = createImpressionSession();
    advanceImpressionSession(look, 0.6, 0);
    assert.deepEqual(advanceImpressionSession(look, 0.6, 1000), { kind: "view" });
  });

  it("counts loops of a clip", () => {
    const session = createClipWatchSession();
    for (const second of [0, 2, 4, 6, 7.8, 0.2, 1]) advanceClipWatchSession(session, second, 8);
    assert.deepEqual(summarizeClipWatchSession(session, 8), { watchMs: 9000, durationMs: 8000, watchFraction: 1, loopCount: 1 });
  });
});
