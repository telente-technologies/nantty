import { conflict, forbidden, notFound } from "../../../../errors/social.error.js";
import { resolveEventActor } from "../../../../events/actor.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { followRepository } from "../../repositories/follow.repository.js";
import { decideFollowRequestResponse } from "../../services/followRules.service.js";
import { buildFollowRequestAcceptedEvents } from "../../services/followRequestEvents.service.js";
import type { RespondToFollowRequestCommand } from "./respondToFollowRequest.command.js";

export function createRespondToFollowRequestHandler(context: HandlerContext): Handler<RespondToFollowRequestCommand, void> {
  return async ({ followeeId, requestId, decision }) => {
    const db = context.database.client;
    const request = await followRepository.findById(db, requestId);
    if (request === null) throw notFound("FOLLOW_REQUEST_NOT_FOUND", "Request not found");
    if (request.followeeId !== followeeId) throw forbidden("FOLLOW_REQUEST_NOT_YOURS", "You can only answer requests sent to you.");
    const outcome = decideFollowRequestResponse(request.state, decision);
    if (outcome === "alreadyDone") return;
    if (outcome === "conflict") throw conflict("FOLLOW_REQUEST_ALREADY_HANDLED", "This request is no longer pending.");
    const accepted = decision === "accept";
    if (accepted && (await blockRepository.eitherDirection(db, followeeId, request.followerId))) throw conflict("FOLLOW_REQUEST_ALREADY_HANDLED", "This request is no longer pending.");
    const now = context.clock.now();
    const [requesterActor, ownerActor] = accepted ? await Promise.all([resolveEventActor(context.directory, request.followerId), resolveEventActor(context.directory, followeeId)]) : [undefined, undefined];
    await context.database.transaction(async (transaction) => {
      if (!(await followRepository.settlePendingRequest(transaction, request.id, accepted ? "accepted" : "rejected", now))) return;
      await appendDomainEventsToOutbox(transaction, requesterActor !== undefined && ownerActor !== undefined
        ? buildFollowRequestAcceptedEvents({ followId: request.id, followerId: request.followerId, followeeId, occurredAt: now, requesterActor, ownerActor, notifyRequester: true })
        : [{ eventType: socialEventTypes.followRejected, subject: request.id, occurredAt: now, data: { followId: request.id, followerId: request.followerId, followeeId } }]);
    });
  };
}
