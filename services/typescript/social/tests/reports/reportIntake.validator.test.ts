import { describe, expect, it } from "vitest";

import { moderationReasonFor, normaliseReportReason } from "../../src/modules/reports/services/reportReasons.service.js";
import { assertReportableBy } from "../../src/modules/reports/services/reportTarget.service.js";
import { submitReportBodySchema } from "../../src/modules/reports/validators/reports.validator.js";
import type { Db } from "../../src/types/database.type.js";

const reporterId = "0192f0a0-0000-7000-8000-00000000a001";
const ownerId = "0192f0a0-0000-7000-8000-00000000b001";
const postId = "0192f0a0-0000-7000-8000-000000000001";

function fakeDb(rows: { readonly post?: { authorId: string } | null; readonly comment?: { authorId: string } | null; readonly sound?: { ownerId: string } | null }): Db {
  return {
    post: { findFirst: async () => rows.post ?? null },
    comment: { findFirst: async () => rows.comment ?? null },
    sound: { findUnique: async () => rows.sound ?? null },
  } as unknown as Db;
}

describe("report intake validator", () => {
  it("accepts product, store and sound targets", () => {
    for (const targetType of ["product", "store", "sound", "space"]) {
      expect(submitReportBodySchema.safeParse({ targetType, targetId: postId, reason: "scam" }).success).toBe(true);
    }
  });

  it("accepts legacy reasons and maps them to current reasons", () => {
    const legacy = { scam_or_fraud: "scam", counterfeit_product: "counterfeit", nudity_or_sexual_content: "sexual_content", hate_or_harassment: "harassment", something_else: "other", nudity: "sexual_content", counterfeit: "counterfeit", misinformation: "misinformation" };
    for (const [raw, expected] of Object.entries(legacy)) {
      expect(submitReportBodySchema.safeParse({ targetType: "product", targetId: postId, reason: raw }).success).toBe(true);
      expect(normaliseReportReason(raw)).toBe(expected);
    }
    expect(submitReportBodySchema.safeParse({ targetType: "post", targetId: postId, reason: "made_up" }).success).toBe(false);
  });

  it("sends moderation a reason it knows", () => {
    expect(moderationReasonFor("prohibited_items")).toBe("prohibited_goods");
    expect(moderationReasonFor("scam")).toBe("scam");
  });
});

describe("report target checks", () => {
  it("rejects reporting your own post, comment, sound or account", async () => {
    await expect(assertReportableBy(fakeDb({ post: { authorId: reporterId } }), reporterId, { targetType: "post", targetId: postId, reportedUserId: undefined })).rejects.toMatchObject({ code: "SELF_REPORT" });
    await expect(assertReportableBy(fakeDb({ comment: { authorId: reporterId } }), reporterId, { targetType: "comment", targetId: postId, reportedUserId: undefined })).rejects.toMatchObject({ code: "SELF_REPORT" });
    await expect(assertReportableBy(fakeDb({ sound: { ownerId: reporterId } }), reporterId, { targetType: "sound", targetId: postId, reportedUserId: undefined })).rejects.toMatchObject({ code: "SELF_REPORT" });
    await expect(assertReportableBy(fakeDb({}), reporterId, { targetType: "user", targetId: reporterId, reportedUserId: undefined })).rejects.toMatchObject({ code: "SELF_REPORT" });
    await expect(assertReportableBy(fakeDb({}), reporterId, { targetType: "product", targetId: postId, reportedUserId: reporterId })).rejects.toMatchObject({ code: "SELF_REPORT" });
  });

  it("returns 404 for content that does not exist and accepts other people's content", async () => {
    await expect(assertReportableBy(fakeDb({ post: null }), reporterId, { targetType: "clip", targetId: postId, reportedUserId: undefined })).rejects.toMatchObject({ status: 404 });
    await expect(assertReportableBy(fakeDb({ post: { authorId: ownerId } }), reporterId, { targetType: "post", targetId: postId, reportedUserId: ownerId })).resolves.toBe(ownerId);
    await expect(assertReportableBy(fakeDb({}), reporterId, { targetType: "store", targetId: postId, reportedUserId: undefined })).resolves.toBeUndefined();
    await expect(assertReportableBy(fakeDb({}), reporterId, { targetType: "space", targetId: "space-key", reportedUserId: undefined })).resolves.toBeUndefined();
    await expect(assertReportableBy(fakeDb({}), reporterId, { targetType: "space", targetId: postId, reportedUserId: undefined })).resolves.toBeUndefined();
  });

  it("rejects a reported account that does not own the selected content", async () => {
    await expect(assertReportableBy(fakeDb({ post: { authorId: ownerId } }), reporterId, { targetType: "post", targetId: postId, reportedUserId: "0192f0a0-0000-7000-8000-00000000c001" })).rejects.toMatchObject({ code: "REPORT_TARGET_MISMATCH" });
  });
});
