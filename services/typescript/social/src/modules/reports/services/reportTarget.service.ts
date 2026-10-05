import { notFound, unprocessable } from "../../../errors/social.error.js";
import type { Db } from "../../../types/database.type.js";
import type { ReportTargetType } from "./reportReasons.service.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missing = () => notFound("TARGET_NOT_FOUND", "We couldn't find what you're reporting.");

async function findLocalOwner(db: Db, targetType: ReportTargetType, targetId: string): Promise<string | null | undefined> {
  if (targetType === "user") return targetId;
  if (!uuidPattern.test(targetId)) return targetType === "post" || targetType === "clip" || targetType === "comment" || targetType === "sound" ? null : undefined;
  if (targetType === "post" || targetType === "clip") {
    const post = await db.post.findFirst({ where: { id: targetId, deletedAt: null, moderationVisibility: { not: "removed" } }, select: { authorId: true } });
    return post?.authorId ?? null;
  }
  if (targetType === "comment") return (await db.comment.findFirst({ where: { id: targetId, deletedAt: null }, select: { authorId: true } }))?.authorId ?? null;
  if (targetType === "sound") return (await db.sound.findUnique({ where: { id: targetId }, select: { ownerId: true } }))?.ownerId ?? null;
  return undefined;
}

export async function assertReportableBy(db: Db, reporterId: string, target: { readonly targetType: ReportTargetType; readonly targetId: string; readonly reportedUserId: string | undefined }): Promise<void> {
  if (target.reportedUserId === reporterId) throw unprocessable("SELF_REPORT", "You can't report your own content.");
  const ownerId = await findLocalOwner(db, target.targetType, target.targetId);
  if (ownerId === null) throw missing();
  if (ownerId === reporterId) throw unprocessable("SELF_REPORT", "You can't report your own content.");
}
