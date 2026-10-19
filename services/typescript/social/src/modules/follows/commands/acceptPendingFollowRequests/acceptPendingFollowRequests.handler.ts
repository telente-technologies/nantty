import { resolveEventActor } from "../../../../events/actor.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { followRepository } from "../../repositories/follow.repository.js";
import { buildFollowRequestAcceptedEvents } from "../../services/followRequestEvents.service.js";
import type { AcceptPendingFollowRequestsCommand } from "./acceptPendingFollowRequests.command.js";

const pendingRequestBatchSize = 200;

export function createAcceptPendingFollowRequestsHandler(context: HandlerContext): Handler<AcceptPendingFollowRequestsCommand, number> {
  return async ({ accountId }) => {
    if ((await context.directory.findPrivateAccountIds([accountId])).has(accountId)) return 0;
    const ownerActor = await resolveEventActor(context.directory, accountId);
    let acceptedCount = 0;
    for (;;) {
      const pending = await followRepository.pagePendingRequestsOf(context.database.client, accountId, pendingRequestBatchSize);
      if (pending.length === 0) return acceptedCount;
      const requesterSummaries = await context.directory.findUserSummaries(pending.map((request) => request.followerId));
      const now = context.clock.now();
      await context.database.transaction(async (transaction) => {
        for (const request of pending) {
          if (!(await followRepository.settlePendingRequest(transaction, request.id, "accepted", now))) continue;
          const summary = requesterSummaries.get(request.followerId);
          const requesterActor = { id: request.followerId, name: summary?.name || summary?.username || "Someone" };
          await appendDomainEventsToOutbox(transaction, buildFollowRequestAcceptedEvents({ followId: request.id, followerId: request.followerId, followeeId: accountId, occurredAt: now, requesterActor, ownerActor, notifyRequester: false }));
          acceptedCount += 1;
        }
      });
      if (pending.length < pendingRequestBatchSize) return acceptedCount;
    }
  };
}
