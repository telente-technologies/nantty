import { blockRepository } from "../../blocks/repositories/block.repository.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { ConnectionEntry } from "../models/follow.model.js";
import { followRepository } from "../repositories/follow.repository.js";
import { deriveViewerFollowState } from "./followRules.service.js";

export async function buildConnectionEntries(context: HandlerContext, viewerId: string | undefined, accountIds: readonly string[]): Promise<ConnectionEntry[]> {
  if (accountIds.length === 0) return [];
  const db = context.database.client;
  const summaries = await context.directory.findUserSummaries(accountIds);
  const emptyStates = new Map<string, "requested" | "accepted" | "rejected">();
  const [states, blocked, blockers, privateAccounts, followsYou] = viewerId === undefined
    ? [emptyStates, new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>()]
    : await Promise.all([
        followRepository.statesFromFollower(db, viewerId, accountIds),
        blockRepository.blockedByViewer(db, viewerId, accountIds),
        blockRepository.blockersOfViewer(db, viewerId, accountIds),
        context.directory.findPrivateAccountIds(accountIds),
        followRepository.acceptedFollowersOf(db, viewerId, accountIds),
      ]);
  const visibleRelationshipIds = new Set(viewerId === undefined ? [] : accountIds.filter((accountId) =>
    accountId !== viewerId && !blocked.has(accountId) && !blockers.has(accountId) && (!privateAccounts.has(accountId) || states.get(accountId) === "accepted"),
  ));
  const mutualCounts = new Map<string, number>();
  if (viewerId !== undefined && visibleRelationshipIds.size > 0) {
    const viewerFollowees = await followRepository.acceptedFolloweeIds(db, viewerId);
    const mutualEdges = await followRepository.acceptedFollowersFromAccounts(db, [...visibleRelationshipIds], [...viewerFollowees]);
    for (const edge of mutualEdges) mutualCounts.set(edge.followerId, (mutualCounts.get(edge.followerId) ?? 0) + 1);
  }
  return accountIds.flatMap((accountId) => {
    const summary = summaries.get(accountId);
    if (summary === undefined) return [];
    const followState = deriveViewerFollowState(blocked.has(accountId), states.get(accountId));
    const relationshipVisible = visibleRelationshipIds.has(accountId);
    return [{
      ...summary,
      isFollowing: followState === "accepted",
      followState,
      followsYou: relationshipVisible && followsYou.has(accountId),
      mutualConnections: relationshipVisible ? Math.max(0, mutualCounts.get(accountId) ?? 0) : 0,
    }];
  });
}
