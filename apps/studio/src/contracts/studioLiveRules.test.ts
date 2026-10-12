import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@/errors/api.error";
import { describeMediaError } from "@/live/useBroadcastMedia.hook";
import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { addBlockedWords } from "@/utils/blockedWords.util";
import { bucketByDate, parseCustomRange, rangeForPreset, sumBuckets } from "@/utils/analyticsBuckets.util";
import { validateScheduleTime, toLocalInputValue } from "@/utils/schedule.util";

const send = (method: string, path: string, body?: unknown) =>
  dispatchMockApiRequest(method, path, new URLSearchParams(), body === undefined ? null : new TextEncoder().encode(JSON.stringify(body)));

const rejectsWith = async (request: Promise<unknown>, status: number, code: string) => {
  await assert.rejects(request, (error: unknown) => error instanceof ApiError && error.status === status && error.code === code);
};

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

describe("scheduling rules", () => {
  it("rejects past, too-far and start-now schedules on create and edit", async () => {
    await rejectsWith(send("POST", "/api/v1/lives", { title: "Past", category: "music", startNow: false, scheduledAt: minutesFromNow(-10) }), 422, "SCHEDULE_IN_PAST");
    await rejectsWith(send("POST", "/api/v1/lives", { title: "Far", category: "music", startNow: false, scheduledAt: minutesFromNow(91 * 24 * 60) }), 422, "SCHEDULE_TOO_FAR");
    await rejectsWith(send("POST", "/api/v1/lives", { title: "Both", category: "music", startNow: true, scheduledAt: minutesFromNow(60) }), 422, "SCHEDULE_WITH_START_NOW");
    const live = (await send("POST", "/api/v1/lives", { title: "Later", category: "music", startNow: false, scheduledAt: minutesFromNow(60) })) as { id: string };
    await rejectsWith(send("PATCH", `/api/v1/lives/${live.id}`, { scheduledAt: minutesFromNow(-1) }), 422, "SCHEDULE_IN_PAST");
    await send("POST", `/api/v1/lives/${live.id}/cancel`);
    await rejectsWith(send("POST", `/api/v1/lives/${live.id}/cancel`), 409, "LIVE_NOT_EDITABLE");
    await rejectsWith(send("PATCH", "/api/v1/lives/live_1", { title: "Mid-stream" }), 409, "LIVE_NOT_EDITABLE");
  });

  it("validates the time on the client before the request is sent", () => {
    const now = Date.now();
    assert.equal(validateScheduleTime(toLocalInputValue(new Date(now - 60_000)), now).date, null);
    assert.equal(validateScheduleTime(toLocalInputValue(new Date(now + 2 * 60_000)), now).date, null);
    assert.equal(validateScheduleTime("not a date", now).error, "Pick a date and time.");
    assert.ok(validateScheduleTime(toLocalInputValue(new Date(now + 60 * 60_000)), now).date);
  });
});

describe("host-only live tools", () => {
  it("refuses another creator's live everywhere", async () => {
    for (const [method, path, body] of [
      ["GET", "/api/v1/lives/live_other_host/stream-health"],
      ["PATCH", "/api/v1/lives/live_other_host", { title: "Mine now" }],
      ["POST", "/api/v1/lives/live_other_host/cancel"],
      ["GET", "/api/v1/lives/live_other_host/recordings"],
      ["PUT", "/api/v1/lives/live_other_host/room-settings", { slowModeSeconds: 5 }],
    ] as const) {
      await rejectsWith(send(method, path, body), 403, "NOT_LIVE_HOST");
    }
    const mine = (await send("GET", "/api/v1/lives")) as { data: { id: string }[] };
    assert.ok(!mine.data.some((live) => live.id === "live_other_host"));
  });

  it("refuses deleting a recording twice", async () => {
    await send("DELETE", "/api/v1/lives/live_2/recordings/rec_2a");
    await rejectsWith(send("DELETE", "/api/v1/lives/live_2/recordings/rec_2a"), 404, "RECORDING_NOT_FOUND");
  });

  it("refuses yourself and too many default moderators", async () => {
    await rejectsWith(send("PUT", "/api/v1/live/host-defaults", { moderatorIds: ["u_me"] }), 422, "MODERATOR_SELF");
    await rejectsWith(send("PUT", "/api/v1/live/host-defaults", { moderatorIds: Array.from({ length: 21 }, (_, index) => `m_${index}`) }), 422, "MODERATOR_LIMIT");
    await rejectsWith(send("PUT", "/api/v1/live/host-defaults", { moderatorIds: ["ghost"] }), 422, "USER_NOT_FOUND");
  });
});

describe("blocked words", () => {
  it("accepts a single emoji but not a single letter, and folds case and fullwidth", () => {
    assert.deepEqual(addBlockedWords([], "🍑").words, ["🍑"]);
    assert.deepEqual(addBlockedWords([], "❤️‍🔥").error, null);
    assert.match(addBlockedWords([], "a").error ?? "", /single emoji/);
    assert.deepEqual(addBlockedWords([], "ＳＣＡＭ, Scam, scam").words, ["scam"]);
    assert.match(addBlockedWords([], "x".repeat(31)).error ?? "", /2-30/);
    assert.equal(addBlockedWords(Array.from({ length: 100 }, (_, index) => `word${index}`), "one more").error, "You can block up to 100 words.");
  });

  it("matches the mock backend", async () => {
    const saved = (await send("PUT", "/api/v1/lives/live_1/room-settings", { blockedWords: ["🍑", "SCAM"] })) as { blockedWords: string[] };
    assert.deepEqual(saved.blockedWords, ["🍑", "scam"]);
    await rejectsWith(send("PUT", "/api/v1/lives/live_1/room-settings", { blockedWords: ["a"] }), 422, "BLOCKED_WORD_INVALID");
  });
});

describe("browser broadcast failures", () => {
  it("explains a denied, missing or busy camera and offers OBS", () => {
    assert.equal(describeMediaError(new DOMException("denied", "NotAllowedError")).permission, "denied");
    assert.match(describeMediaError(new DOMException("none", "NotFoundError")).message, /OBS/);
    assert.match(describeMediaError(new DOMException("busy", "NotReadableError")).message, /another app/);
    assert.equal(describeMediaError(new Error("odd")).permission, "unavailable");
  });
});

describe("analytics buckets", () => {
  it("buckets by day up to a month and by week beyond", () => {
    const now = new Date(2026, 9, 11, 15);
    const week = rangeForPreset("7d", now);
    const items = [{ at: new Date(2026, 9, 11, 9).toISOString(), value: 5 }, { at: new Date(2026, 9, 5, 1).toISOString(), value: 2 }, { at: new Date(2026, 8, 1).toISOString(), value: 100 }];
    const daily = bucketByDate(items, week, (item) => item.at, (item) => item.value);
    assert.equal(daily.length, 7);
    assert.equal(sumBuckets(daily), 7);
    assert.equal(daily.at(-1)?.value, 5);
    assert.equal(bucketByDate(items, rangeForPreset("90d", now), (item) => item.at, (item) => item.value).length, 13);
  });

  it("validates custom ranges", () => {
    const now = new Date(2026, 9, 11);
    assert.equal(parseCustomRange("2026-10-05", "2026-10-01", now).error, "The start date must be on or before the end date.");
    assert.equal(parseCustomRange("2026-12-01", "2026-12-05", now).error, "The start date can't be in the future.");
    assert.match(parseCustomRange("2024-01-01", "2026-10-01", now).error ?? "", /up to 366 days/);
    assert.equal(parseCustomRange("", "2026-10-01", now).error, "Pick a start and an end date.");
    assert.ok(parseCustomRange("2026-10-01", "2026-10-01", now).range);
  });
});
