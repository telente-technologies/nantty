import { conflict, notFound } from "../../../../errors/social.error.js";
import { resolveEventActor } from "../../../../events/actor.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { followRepository } from "../../repositories/follow.repository.js";
import type { RespondToFollowRequestCommand } from "./respondToFollowRequest.command.js";

export function createRespondToFollowRequestHandler(context: HandlerContext): Handler<RespondToFollowRequestCommand, void> {
  return async ({ followeeId, requestId, decision }) => {
    const request = await followRepository.findById(context.database.client, requestId);
    if (request === null || request.followeeId !== followeeId) throw notFound("FOLLOW_REQUEST_NOT_FOUND", "Request not found");
    if (request.state !== "requested") throw conflict("FOLLOW_REQUEST_ALREADY_HANDLED", "This request was already handled.");
    const now = context.clock.now();
    const accepted = decision === "accept";
    const actor = await resolveEventActor(context.directory, request.followerId);
    await context.database.transaction(async (transaction) => {
      await followRepository.setState(transaction, request.id, accepted ? "accepted" : "rejected", now);
      const data = { followId: request.id, followerId: request.followerId, followeeId, recipientUserId: followeeId, actor, url: `/user/${request.followerId}` };
      await appendDomainEventsToOutbox(transaction, [accepted
        ? { eventType: socialEventTypes.followCreated, subject: request.id, occurredAt: now, data: { ...data, state: "accepted" } }
        : { eventType: socialEventTypes.followRejected, subject: request.id, occurredAt: now, data }]);
    });
  };
}
