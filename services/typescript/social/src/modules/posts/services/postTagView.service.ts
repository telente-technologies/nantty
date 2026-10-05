import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { CheckmarkColor, UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import type { TaggedUserView } from "../models/post.model.js";
import { postTagRepository } from "../repositories/postTag.repository.js";

export const taggedPreviewSize = 3;

export interface TaggedUsersPreview {
  readonly users: readonly TaggedUserView[];
  readonly count: number;
}

export function toTaggedUserView(summary: UserSummary, isFollowing: boolean | undefined, checkmark: CheckmarkColor | undefined): TaggedUserView {
  return {
    id: summary.id,
    username: summary.username,
    displayName: summary.name,
    avatarUrl: summary.avatarUrl,
    checkmark: checkmark ?? null,
    ...(isFollowing === undefined ? {} : { isFollowing }),
  };
}

export async function loadTaggedUserViews(context: HandlerContext, viewerId: string | undefined, userIds: readonly string[]): Promise<Map<string, TaggedUserView>> {
  const db = context.database.client;
  const unique = [...new Set(userIds)];
  const [summaries, blocked, blockers, followed, checkmarks] = await Promise.all([
    context.directory.findUserSummaries(unique),
    viewerId === undefined ? new Set<string>() : blockRepository.blockedByViewer(db, viewerId, unique),
    viewerId === undefined ? new Set<string>() : blockRepository.blockersOfViewer(db, viewerId, unique),
    viewerId === undefined ? undefined : followRepository.followedAccountIds(db, viewerId, unique),
    context.directory.findCheckmarkColors(unique),
  ]);
  const views = new Map<string, TaggedUserView>();
  for (const [id, summary] of summaries) if (!blocked.has(id) && !blockers.has(id)) views.set(id, toTaggedUserView(summary, followed?.has(id), checkmarks.get(id)));
  return views;
}

export async function loadTaggedPreviews(context: HandlerContext, viewerId: string | undefined, postIds: readonly string[]): Promise<Map<string, TaggedUsersPreview>> {
  const previews = new Map<string, TaggedUsersPreview>();
  if (postIds.length === 0) return previews;
  const rows = await postTagRepository.forPosts(context.database.client, postIds);
  if (rows.length === 0) return previews;
  const views = await loadTaggedUserViews(context, viewerId, rows.map((row) => row.taggedUserId));
  const visibleByPost = new Map<string, TaggedUserView[]>();
  for (const row of rows) {
    const view = views.get(row.taggedUserId);
    if (view !== undefined) visibleByPost.set(row.postId, [...(visibleByPost.get(row.postId) ?? []), view]);
  }
  for (const [postId, users] of visibleByPost) previews.set(postId, { users: users.slice(0, taggedPreviewSize), count: users.length });
  return previews;
}
