import { unprocessable } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import { postTagRepository } from "../repositories/postTag.repository.js";

export const maximumTaggedUsers = 20;

export function dedupeTaggedUserIds(ids: readonly string[]): string[] {
  const unique = [...new Set(ids)];
  if (unique.length > maximumTaggedUsers) throw unprocessable("TOO_MANY_TAGS", `You can tag up to ${maximumTaggedUsers} people.`);
  return unique;
}

export function selectTaggableUserIds(context: HandlerContext, authorId: string, requested: readonly string[]): Promise<string[]> {
  return filterTaggableUserIds(context, authorId, dedupeTaggedUserIds(requested));
}

export async function filterTaggableUserIds(context: HandlerContext, authorId: string, requested: readonly string[]): Promise<string[]> {
  const candidates = [...new Set(requested)].filter((id) => id !== authorId);
  if (candidates.length === 0) return [];
  const db = context.database.client;
  const [statuses, blockers, blocked, taggingOff] = await Promise.all([
    context.directory.findMentionTargetStatuses(candidates),
    blockRepository.blockersOfViewer(db, authorId, candidates),
    blockRepository.blockedByViewer(db, authorId, candidates),
    postTagRepository.taggingDisabledAmong(db, candidates),
  ]);
  return candidates.filter((id) => statuses.get(id)?.status === "active" && !blockers.has(id) && !blocked.has(id) && !taggingOff.has(id));
}
