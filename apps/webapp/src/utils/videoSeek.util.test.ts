import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { advanceClipWatchSession, createClipWatchSession, markClipWatchSeek, summarizeClipWatchSession } from "./clipWatchSession.util";
import { bufferedEndAround, clampSeekSeconds, formatPlaybackTime, fractionFromPointer, isScrubbableDuration, secondsAtFraction, videoShortcutFor } from "./videoSeek.util";

describe("video seek maths", () => {
  it("maps the pointer across the track and clamps outside it", () => {
    assert.equal(fractionFromPointer(150, 100, 200), 0.25);
    assert.equal(fractionFromPointer(40, 100, 200), 0);
    assert.equal(fractionFromPointer(900, 100, 200), 1);
    assert.equal(fractionFromPointer(150, 100, 0), 0);
  });

  it("never seeks past the end or before the start", () => {
    assert.equal(clampSeekSeconds(95, 90), 89.75);
    assert.equal(clampSeekSeconds(-3, 90), 0);
    assert.equal(clampSeekSeconds(12, Number.NaN), 12);
    assert.equal(secondsAtFraction(1, 20), 19.75);
  });

  it("only offers scrubbing from five seconds", () => {
    assert.equal(isScrubbableDuration(3), false);
    assert.equal(isScrubbableDuration(5), true);
  });

  it("formats playback time", () => {
    assert.equal(formatPlaybackTime(9.7), "0:09");
    assert.equal(formatPlaybackTime(3601), "1:00:01");
  });

  it("finds the buffered range around the playhead", () => {
    assert.equal(bufferedEndAround([[0, 12], [30, 40]], 5), 12);
    assert.equal(bufferedEndAround([[0, 12], [30, 40]], 20), 0);
  });
});

describe("video keyboard shortcuts", () => {
  it("maps arrows to 5s, J and L to 10s, K and space to play or pause", () => {
    assert.deepEqual(videoShortcutFor("ArrowLeft", false), { kind: "seek", deltaSeconds: -5 });
    assert.deepEqual(videoShortcutFor("ArrowRight", false), { kind: "seek", deltaSeconds: 5 });
    assert.deepEqual(videoShortcutFor("j", false), { kind: "seek", deltaSeconds: -10 });
    assert.deepEqual(videoShortcutFor("L", false), { kind: "seek", deltaSeconds: 10 });
    assert.deepEqual(videoShortcutFor("k", false), { kind: "togglePlay" });
    assert.deepEqual(videoShortcutFor(" ", false), { kind: "togglePlay" });
  });

  it("leaves browser shortcuts and other keys alone", () => {
    assert.equal(videoShortcutFor("l", true), null);
    assert.equal(videoShortcutFor("ArrowDown", false), null);
    assert.equal(videoShortcutFor("m", false), null);
  });
});

describe("watch time with seeks", () => {
  it("counts played seconds, not the jump, when skipping ahead", () => {
    const session = createClipWatchSession();
    for (const second of [0, 1, 2]) advanceClipWatchSession(session, second, 60);
    markClipWatchSeek(session, 4);
    for (const second of [4, 5, 6]) advanceClipWatchSession(session, second, 60);
    assert.equal(summarizeClipWatchSession(session, 60).watchMs, 4000);
  });

  it("does not count scrubbing back from the end as a loop", () => {
    const session = createClipWatchSession();
    for (const second of [0, 2, 4, 6, 8, 9]) advanceClipWatchSession(session, second, 10);
    markClipWatchSeek(session, 0.3);
    for (const second of [0.3, 1.3]) advanceClipWatchSession(session, second, 10);
    assert.deepEqual(summarizeClipWatchSession(session, 10), { watchMs: 10_000, durationMs: 10_000, watchFraction: 0.9, loopCount: 0 });
  });
});
