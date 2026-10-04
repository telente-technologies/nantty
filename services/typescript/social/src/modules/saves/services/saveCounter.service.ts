import type { SavedItemType } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

const postSaveTypes: readonly SavedItemType[] = ["post", "video", "clip"];

export function isPostSaveType(type: SavedItemType): boolean {
  return postSaveTypes.includes(type);
}

export async function adjustSaveCount(db: Db, type: SavedItemType, targetId: string, by: number): Promise<void> {
  if (by === 0) return;
  if (isPostSaveType(type)) {
    if (by > 0) await db.post.updateMany({ where: { id: targetId }, data: { saveCount: { increment: by } } });
    else await db.post.updateMany({ where: { id: targetId, saveCount: { gte: -by } }, data: { saveCount: { decrement: -by } } });
    return;
  }
  if (by > 0) {
    await db.saveCounter.upsert({ where: { type_targetId: { type, targetId } }, create: { type, targetId, count: by }, update: { count: { increment: by } } });
    return;
  }
  await db.saveCounter.updateMany({ where: { type, targetId, count: { gte: -by } }, data: { count: { decrement: -by } } });
}

export async function saveCountsFor(db: Db, type: SavedItemType, targetIds: readonly string[]): Promise<Map<string, number>> {
  if (isPostSaveType(type)) {
    const rows = await db.post.findMany({ where: { id: { in: [...targetIds] } }, select: { id: true, saveCount: true } });
    return new Map(rows.map((row) => [row.id, row.saveCount]));
  }
  const rows = await db.saveCounter.findMany({ where: { type, targetId: { in: [...targetIds] } } });
  return new Map(rows.map((row) => [row.targetId, row.count]));
}
