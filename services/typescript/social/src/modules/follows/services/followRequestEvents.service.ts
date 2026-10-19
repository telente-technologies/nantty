import type { EventActor } from "../../../events/actor.event.js";
import { socialEventTypes } from "../../../events/eventTypes.event.js";

export interface FollowRequestAcceptance {
  readonly followId: string;
  readonly followerId: string;
  readonly followeeId: string;
  readonly occurredAt: Date;
  readonly requesterActor: EventActor;
  readonly ownerActor: EventActor;
  readonly notifyRequester: boolean;
}

export function buildFollowRequestAcceptedEvents(acceptance: FollowRequestAcceptance) {
  const { followId, followerId, followeeId, occurredAt } = acceptance;
  const followCreated = {
    eventType: socialEventTypes.followCreated,
    subject: followId,
    occurredAt,
    data: { followId, followerId, followeeId, recipientUserId: followeeId, actor: acceptance.requesterActor, url: `/user/${followerId}`, state: "accepted", viaRequest: true },
  };
  if (!acceptance.notifyRequester) return [followCreated];
  return [followCreated, {
    eventType: socialEventTypes.followRequestAccepted,
    subject: followId,
    occurredAt,
    data: { followId, followerId, followeeId, recipientUserId: followerId, actor: acceptance.ownerActor, url: `/user/${followeeId}` },
  }];
}
