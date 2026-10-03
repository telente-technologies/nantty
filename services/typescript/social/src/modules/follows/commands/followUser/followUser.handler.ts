import { forbidden, notFound, unprocessable } from "../../../../errors/social.error.js";
import { resolveEventActor } from "../../../../events/actor.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import type { FollowResult } from "../../models/follow.model.js";
import { followRepository } from "../../repositories/follow.repository.js";
import { decideFollowOutcome } from "../../services/followRules.service.js";
import type { FollowUserCommand } from "./followUser.command.js";

export function createFollowUserHandler(context: HandlerContext): Handler<FollowUserCommand, FollowResult> {
  return async ({ followerId, targetId }) => {
    if (followerId === targetId) throw unprocessable("CANNOT_FOLLOW_SELF", "You can't follow yourself.");
    const db = context.database.client;
    const target = (await context.directory.findUserSummaries([targetId])).get(targetId);
    if (target === undefined) throw notFound("USER_NOT_FOUND", "User not found.");
    const [privateAccounts, existing, hasBlocked, isBlockedBy] = await Promise.all([
      context.directory.findPrivateAccountIds([targetId]),
      followRepository.find(db, followerId, targetId),
      blockRepository.exists(db, followerId, targetId),
      blockRepository.exists(db, targetId, followerId),
    ]);
    const decision = decideFollowOutcome({ followerHasBlockedTarget: hasBlocked, followerIsBlockedByTarget: isBlockedBy, targetIsPrivate: privateAccounts.has(targetId), existing: existing?.state });
    if (decision.outcome === "refused") throw forbidden("FOLLOW_NOT_ALLOWED", "You can't follow this account");
    if (decision.outcome === "unchanged") return { state: decision.state };
    const now = context.clock.now();
    const actor = await resolveEventActor(context.directory, followerId);
    await context.database.transaction(async (transaction) => {
      const follow = await followRepository.upsertState(transaction, followerId, targetId, decision.state);
      const base = { followId: follow.id, followerId, followeeId: targetId, recipientUserId: targetId, actor, url: `/user/${followerId}` };
      await appendDomainEventsToOutbox(transaction, [decision.state === "requested"
        ? { eventType: socialEventTypes.followRequestCreated, subject: follow.id, occurredAt: now, data: base }
        : { eventType: socialEventTypes.followCreated, subject: follow.id, occurredAt: now, data: { ...base, state: "accepted" } }]);
    });
    return { state: decision.state };
  };
}
