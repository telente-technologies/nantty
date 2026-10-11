import { describe, expect, it, vi } from "vitest";

import { blockForChatReport } from "../../src/jobs/contentEvents.job.js";
import { createContentEventRouter } from "../../src/modules/contentEvents/services/contentEventRouter.service.js";
import { notFound } from "../../src/errors/social.error.js";

const reporterId = "0192f0a0-0000-7000-8000-0000000000c1";
const reportedUserId = "0192f0a0-0000-7000-8000-0000000000c2";
const envelope = (data: Record<string, unknown>) => JSON.stringify({ type: "chatReport.received", occurredAt: "2026-10-10T10:00:00Z", data });

function routerWith(blockReportedUser: (command: { reporterId: string; reportedUserId: string }) => Promise<unknown>) {
  return createContentEventRouter({ applyContentVisibility: vi.fn(), applyProcessedMedia: vi.fn(), blockReportedUser });
}

describe("report-and-block from the trust intake", () => {
  it("blocks the reported user when the reporter asked for it", async () => {
    const block = vi.fn(async () => undefined);
    await routerWith(block)(envelope({ reportId: "r1", reporterId, reportedUserId, blockReportedUser: true }));
    expect(block).toHaveBeenCalledWith({ reporterId, reportedUserId });
  });

  it("does nothing when no block was requested", async () => {
    const block = vi.fn(async () => undefined);
    await routerWith(block)(envelope({ reportId: "r2", reporterId, reportedUserId, blockReportedUser: false }));
    expect(block).not.toHaveBeenCalled();
  });

  it("rejects a block request that names no reported user", async () => {
    await expect(routerWith(vi.fn())(envelope({ reportId: "r3", reporterId, blockReportedUser: true }))).rejects.toThrow("both users");
  });

  it("acknowledges blocks that can never succeed but retries other failures", async () => {
    const missingUser = blockForChatReport(async () => { throw notFound("USER_NOT_FOUND", "User not found."); });
    await expect(missingUser({ reporterId, reportedUserId })).resolves.toBeUndefined();
    const outage = blockForChatReport(async () => { throw new Error("database unavailable"); });
    await expect(outage({ reporterId, reportedUserId })).rejects.toThrow("database unavailable");
  });

  it("passes the reporter as the blocker", async () => {
    const block = vi.fn(async () => undefined);
    await blockForChatReport(block)({ reporterId, reportedUserId });
    expect(block).toHaveBeenCalledWith({ blockerId: reporterId, targetId: reportedUserId });
  });
});
