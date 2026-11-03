import assert from "node:assert/strict";
import { test } from "node:test";

import { validateScheduleDate } from "./scheduledPosts.util";

const now = Date.parse("2026-11-02T12:00:00.000Z");

test("schedule date validation mirrors the API minimum and 90-day horizon", () => {
  assert.equal(validateScheduleDate("", now).message, "Choose a valid date and time.");
  assert.equal(validateScheduleDate("2026-11-02T12:00:30Z", now).message, "Choose a time at least one minute from now.");
  assert.equal(validateScheduleDate("2027-02-01T12:00:00Z", now).message, "Posts can be scheduled up to 90 days ahead.");
  assert.deepEqual(validateScheduleDate("2026-11-02T12:02:00Z", now), { scheduledAt: "2026-11-02T12:02:00.000Z", message: "" });
});
