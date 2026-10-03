import { blockRepository } from "../../blocks/repositories/block.repository.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { ConnectionEntry } from "../models/follow.model.js";
import { followRepository } from "../repositories/follow.repository.js";
import { deriveViewerFollowState } from "./followRules.service.js";

export async function buildConnectionEntries(context: HandlerContext, viewerId: string | undefined, accountIds: readonly string[]): Promise<ConnectionEntry[]> {
  if (accountIds.length === 0) return [];
  const db = context.database.client;
  const summaries = await context.directory.findUserSummaries(accountIds);
  const [states, blocked] = viewerId === undefined
    ? [new Map<string, "requested" | "accepted" | "rejected">(), new Set<string>()]
    : await Promise.all([followRepository.statesFromFollower(db, viewerId, accountIds), blockRepository.blockedByViewer(db, viewerId, accountIds)]);
  return accountIds.flatMap((accountId) => {
    const summary = summaries.get(accountId);
    if (summary === undefined) return [];
    const followState = deriveViewerFollowState(blocked.has(accountId), states.get(accountId));
    return [{ ...summary, isFollowing: followState === "accepted", followState }];
  });
}
