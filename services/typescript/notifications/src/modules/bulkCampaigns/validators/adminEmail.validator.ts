import { z } from "zod";

const audienceSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("USER"), username: z.string().trim().min(1).max(64) }),
  z.strictObject({ type: z.literal("SEGMENT"), segmentId: z.string().trim().min(1).max(64) }),
]);

const draftShape = {
  kind: z.enum(["TRANSACTIONAL", "MARKETING"]),
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(8000),
  audience: audienceSchema,
};

export const previewAdminEmailBodySchema = z.strictObject(draftShape);
export const sendAdminEmailBodySchema = z.strictObject({ ...draftShape, reason: z.string().trim().min(5).max(500) });

export const queueLegalNoticeBodySchema = z.strictObject({ versionId: z.string().trim().min(1).max(100), reason: z.string().trim().min(5).max(500) });

export const updateNoticeDraftBodySchema = z.strictObject({
  subject: z.string().trim().min(5).max(150),
  summaryText: z.string().trim().min(10).max(1500),
  whatChanged: z.array(z.string().trim().min(1).max(300)).max(30),
  reacceptNote: z.string().trim().max(600).nullable(),
});
