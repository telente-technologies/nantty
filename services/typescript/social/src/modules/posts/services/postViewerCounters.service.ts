import type { Db } from "../../../types/database.type.js";

export const repeatInteractionCooldownMs = 10 * 60_000;

export type ViewerCooldownField = "lastViewedAt" | "lastWatchedAt" | "lastLinkClickAt" | "lastProfileClickAt";

async function ensureViewerRow(db: Db, postId: string, viewerKey: string): Promise<void> {
  await db.postViewer.createMany({ data: [{ postId, viewerKey }], skipDuplicates: true });
}

export async function claimViewerCooldown(db: Db, postId: string, viewerKey: string, field: ViewerCooldownField, now: Date): Promise<boolean> {
  await ensureViewerRow(db, postId, viewerKey);
  const threshold = new Date(now.getTime() - repeatInteractionCooldownMs);
  const claimed = await db.postViewer.updateMany({
    where: { postId, viewerKey, OR: [{ [field]: null }, { [field]: { lt: threshold } }] },
    data: { [field]: now },
  });
  return claimed.count === 1;
}

export async function claimFollowAttribution(db: Db, postId: string, viewerKey: string, now: Date): Promise<boolean> {
  await ensureViewerRow(db, postId, viewerKey);
  const claimed = await db.postViewer.updateMany({ where: { postId, viewerKey, followAttributedAt: null }, data: { followAttributedAt: now } });
  return claimed.count === 1;
}

export function plausibleWatchMs(watchMs: number | undefined, durationMs: number | undefined, loopCount: number | undefined, maximum: number): number {
  const watched = Math.min(maximum, Math.max(0, Math.round(watchMs ?? durationMs ?? 0)));
  if (durationMs === undefined || durationMs <= 0) return watched;
  const plays = Math.min(100, Math.max(0, Math.round(loopCount ?? 0))) + 1;
  return Math.min(watched, durationMs * plays);
}
