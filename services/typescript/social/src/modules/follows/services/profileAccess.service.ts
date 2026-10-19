import { blockRepository } from "../../blocks/repositories/block.repository.js";
import { forbidden, notFound } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { followRepository } from "../repositories/follow.repository.js";
import { decideProfileVisibility } from "./followRules.service.js";

export async function assertViewerMaySeeConnections(context: HandlerContext, viewerId: string | undefined, ownerId: string): Promise<void> {
  const db = context.database.client;
  const owner = (await context.directory.findUserSummaries([ownerId])).get(ownerId);
  if (owner === undefined) throw notFound("USER_NOT_FOUND", "User not found.");
  const viewerIsOwner = viewerId === ownerId;
  const [privateOwners, viewerFollowState, ownerHasBlockedViewer, viewerHasBlockedOwner] = await Promise.all([
    context.directory.findPrivateAccountIds([ownerId]),
    viewerId === undefined || viewerIsOwner ? undefined : followRepository.find(db, viewerId, ownerId),
    viewerId === undefined || viewerIsOwner ? false : blockRepository.exists(db, ownerId, viewerId),
    viewerId === undefined || viewerIsOwner ? false : blockRepository.exists(db, viewerId, ownerId),
  ]);
  const visibility = decideProfileVisibility({
    viewerId,
    ownerId,
    ownerIsPrivate: privateOwners.has(ownerId),
    viewerIsAcceptedFollower: viewerFollowState?.state === "accepted",
    ownerHasBlockedViewer,
    viewerHasBlockedOwner,
  });
  if (visibility === "hidden") throw notFound("USER_NOT_FOUND", "User not found.");
  if (visibility === "private") throw forbidden("ACCOUNT_PRIVATE", "This account is private");
}

export async function filterAuthorsVisibleToViewer(context: HandlerContext, viewerId: string | undefined, authorIds: readonly string[]): Promise<ReadonlySet<string>> {
  const unique = [...new Set(authorIds)];
  if (unique.length === 0) return new Set();
  const db = context.database.client;
  const [privateAuthors, followed, blockers, blocked] = await Promise.all([
    context.directory.findPrivateAccountIds(unique),
    viewerId === undefined ? new Set<string>() : followRepository.followedAccountIds(db, viewerId, unique),
    viewerId === undefined ? new Set<string>() : blockRepository.blockersOfViewer(db, viewerId, unique),
    viewerId === undefined ? new Set<string>() : blockRepository.blockedByViewer(db, viewerId, unique),
  ]);
  return new Set(unique.filter((authorId) => {
    if (authorId === viewerId) return true;
    if (blockers.has(authorId) || blocked.has(authorId)) return false;
    return !privateAuthors.has(authorId) || followed.has(authorId);
  }));
}
