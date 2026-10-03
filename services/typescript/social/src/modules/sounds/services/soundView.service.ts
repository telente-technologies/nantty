import type { Sound } from "../../../generated/prisma/client.js";
import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { SoundView } from "../models/sound.model.js";
import { soundRepository } from "../repositories/sound.repository.js";

export async function buildSoundViews(context: HandlerContext, viewerId: string | undefined, rows: readonly Sound[]): Promise<SoundView[]> {
  if (rows.length === 0) return [];
  const [owners, saved] = await Promise.all([
    context.directory.findUserSummaries(rows.map((row) => row.ownerId)),
    viewerId === undefined ? new Set<string>() : soundRepository.savedIds(context.database.client, viewerId, rows.map((row) => row.id)),
  ]);
  const unknown = (id: string): UserSummary => ({ id, name: "", username: "", avatarUrl: null, verified: false, isCreator: false });
  return rows.map((row) => ({
    id: row.id, title: row.title, owner: owners.get(row.ownerId) ?? unknown(row.ownerId), isOriginal: row.isOriginal, allowReuse: row.allowReuse, status: row.status,
    usageCount: row.usageCount, audioUrl: row.audioUrl, coverUrl: row.coverUrl, sourceClipId: row.sourceClipId, savedByViewer: saved.has(row.id),
  }));
}

export function canUseSound(sound: { readonly ownerId: string; readonly allowReuse: boolean; readonly status: string }, accountId: string): boolean {
  return sound.status === "available" && (sound.ownerId === accountId || sound.allowReuse);
}
