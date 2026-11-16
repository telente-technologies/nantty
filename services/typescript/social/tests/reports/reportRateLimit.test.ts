import { describe, expect, it, vi } from "vitest";

import { reportsPerHourLimit } from "../../src/constants/social.constant.js";
import type { Db } from "../../src/types/database.type.js";
import { lockAndCheckReportRateLimit } from "../../src/modules/reports/services/reportRateLimit.service.js";

function makeDb(reportCount: number) {
  const calls: string[] = [];
  const db = {
    $queryRaw: vi.fn(async () => { calls.push("lock"); return []; }),
    reportIntake: { count: vi.fn(async () => { calls.push("count"); return reportCount; }) },
  } as unknown as Db;
  return { db, calls };
}

describe("report intake rate limit", () => {
  it("takes a transaction-scoped reporter lock before counting submissions", async () => {
    const { db, calls } = makeDb(reportsPerHourLimit - 1);

    await expect(lockAndCheckReportRateLimit(db, "reporter-id", new Date(0))).resolves.toBeUndefined();

    expect(calls).toEqual(["lock", "count"]);
    expect(db.$queryRaw).toHaveBeenCalledWith(expect.anything(), "reporter-id");
  });

  it("rejects once the reporter has reached the hourly limit", async () => {
    const { db } = makeDb(reportsPerHourLimit);

    await expect(lockAndCheckReportRateLimit(db, "reporter-id", new Date(0))).rejects.toMatchObject({
      status: 429,
      code: "REPORT_RATE_LIMITED",
    });
  });
});
