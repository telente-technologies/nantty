import { describe, expect, it } from "vitest";

import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { createSubmitReportHandler } from "../../src/modules/reports/commands/submitReport/submitReport.handler.js";
import type { SubmitReportCommand } from "../../src/modules/reports/commands/submitReport/submitReport.command.js";
import type { Db } from "../../src/types/database.type.js";

const reporterId = "0192f0a0-0000-7000-8000-00000000a001";
const reportedUserId = "0192f0a0-0000-7000-8000-00000000b001";
const now = new Date("2026-11-14T12:00:00Z");

function setup(options: { readonly failBlockEvent?: boolean; readonly existingBlock?: boolean } = {}) {
  const state = { reports: [] as Record<string, unknown>[], blocks: options.existingBlock ? [{ blockerId: reporterId, blockedId: reportedUserId }] : [] as Record<string, unknown>[], follows: [] as Record<string, unknown>[], events: [] as Record<string, unknown>[] };
  let transactionCalls = 0;
  const context = {
    database: {
      client: {},
      transaction: async <T>(work: (transaction: Db) => Promise<T>) => {
        transactionCalls += 1;
        const draft = structuredClone(state);
        const transaction = {
          $queryRaw: async () => [],
          reportIntake: {
            count: async ({ where }: { where: { reporterId: string; createdAt: { gte: Date } } }) => draft.reports.filter((report) => report["reporterId"] === where.reporterId && report["createdAt"] instanceof Date && (report["createdAt"] as Date) >= where.createdAt.gte).length,
            create: async ({ data }: { data: Record<string, unknown> }) => { const report = { id: "report-id", createdAt: now, ...data }; draft.reports.push(report); return report; },
          },
          block: { createMany: async ({ data }: { data: readonly Record<string, unknown>[] }) => {
            const fresh = data.filter((row) => !draft.blocks.some((existing) => existing["blockerId"] === row["blockerId"] && existing["blockedId"] === row["blockedId"]));
            draft.blocks.push(...fresh);
            return { count: fresh.length };
          } },
          follow: { deleteMany: async () => ({ count: 0 }) },
          postNotificationMute: { findMany: async () => [] },
          outboxEvent: { createMany: async ({ data }: { data: readonly Record<string, unknown>[] }) => {
            if (options.failBlockEvent && data.some((event) => (event["payload"] as { type?: string } | undefined)?.type === "block.created")) throw new Error("outbox unavailable");
            draft.events.push(...data);
            return { count: data.length };
          } },
        } as unknown as Db;
        const result = await work(transaction);
        Object.assign(state, draft);
        return result;
      },
    },
    directory: { findUserSummaries: async (ids: readonly string[]) => new Map(ids.includes(reportedUserId) ? [[reportedUserId, { id: reportedUserId }]] : []) },
    clock: { now: () => now },
  } as unknown as HandlerContext;
  const command: SubmitReportCommand = {
    reporterId, targetType: "user", targetId: reportedUserId, conversationId: undefined, reportedUserId,
    reason: "scam", details: "", blockReportedUser: true, evidence: [], evidenceSelection: undefined, evidenceHash: undefined,
  };
  return { state, context, command, getTransactionCalls: () => transactionCalls };
}

describe("report and block transaction", () => {
  it("persists the report and block together with their outbox events", async () => {
    const world = setup();

    await expect(createSubmitReportHandler(world.context)(world.command)).resolves.toMatchObject({ id: "report-id", status: "received" });

    expect(world.state.reports).toHaveLength(1);
    expect(world.state.blocks).toHaveLength(1);
    expect(world.state.events.map((event) => (event["payload"] as { type: string }).type)).toEqual(["report.created", "block.created"]);
    expect(world.getTransactionCalls()).toBe(1);
  });

  it("does not persist the report if the block outbox write fails", async () => {
    const world = setup({ failBlockEvent: true });

    await expect(createSubmitReportHandler(world.context)(world.command)).rejects.toThrow("outbox unavailable");

    expect(world.state.reports).toHaveLength(0);
    expect(world.state.blocks).toHaveLength(0);
    expect(world.state.events).toHaveLength(0);
  });

  it("rejects a block request without a reported account before opening a transaction", async () => {
    const world = setup();

    await expect(createSubmitReportHandler(world.context)({ ...world.command, reportedUserId: undefined })).rejects.toMatchObject({ code: "REPORTED_USER_REQUIRED" });

    expect(world.getTransactionCalls()).toBe(0);
  });

  it("rejects a profile report whose account identifier does not match the profile target", async () => {
    const world = setup();

    await expect(createSubmitReportHandler(world.context)({ ...world.command, blockReportedUser: false, reportedUserId: "0192f0a0-0000-7000-8000-00000000c001" })).rejects.toMatchObject({ code: "REPORT_TARGET_MISMATCH" });

    expect(world.getTransactionCalls()).toBe(0);
  });

  it("keeps an existing block idempotent without publishing another block event", async () => {
    const world = setup({ existingBlock: true });

    await createSubmitReportHandler(world.context)(world.command);

    expect(world.state.blocks).toHaveLength(1);
    expect(world.state.events.map((event) => (event["payload"] as { type: string }).type)).toEqual(["report.created"]);
  });
});
