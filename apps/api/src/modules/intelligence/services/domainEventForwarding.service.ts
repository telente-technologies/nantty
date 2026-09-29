import type { EventBus } from "@zudojs/events";

import type { Clock } from "../../../interfaces/clock.interface.js";
import type { IntelligenceEventSink } from "../../../interfaces/intelligence.interface.js";
import type { OrderLookup } from "../../../interfaces/orderLookup.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import { subscribeToEvent } from "../../../loaders/events.loader.js";
import { LiveGiftSentEvent } from "../../creators/events/liveGiftSent.event.js";
import { FollowedEvent } from "../../follows/events/followed.event.js";
import { OrderPaidEvent } from "../../orders/events/orderPlaced.event.js";
import { PostCommentedEvent } from "../../posts/events/postCommented.event.js";
import { PostLikedEvent } from "../../posts/events/postLiked.event.js";
import { createDeterministicEventId } from "./identifierHashing.service.js";

export interface ForwardedPostFacts {
  readonly authorId: string;
  readonly topics: readonly string[];
}

export interface DomainEventForwardingDependencies {
  readonly events: EventBus;
  readonly sink: IntelligenceEventSink;
  readonly clock: Clock;
  readonly logger: AppLogger;
  readonly orderLookup: OrderLookup;
  readonly findPostFacts: (postId: string) => Promise<ForwardedPostFacts | undefined>;
}

export function subscribeIntelligenceEventForwarding(dependencies: DomainEventForwardingDependencies): void {
  const { events, sink, clock, logger, orderLookup, findPostFacts } = dependencies;
  const forwardSafely = (label: string, work: () => Promise<void>) =>
    work().catch((error: unknown) => logger.warn("Could not queue an intelligence event", { label, error: String(error) }));

  subscribeToEvent(events, PostLikedEvent, (payload) =>
    forwardSafely("post_liked", async () => {
      const post = await findPostFacts(payload.postId);
      await sink.record({
        eventType: "post_liked",
        eventId: createDeterministicEventId(["post_liked", payload.postId, payload.userId, clock.now().toISOString()]),
        actorUserId: payload.userId,
        occurredAt: clock.now(),
        payload: { postId: payload.postId, authorUserId: payload.authorId, topics: post?.topics ?? [] },
      });
    }));

  subscribeToEvent(events, PostCommentedEvent, (payload) =>
    forwardSafely("commented", async () => {
      const post = await findPostFacts(payload.postId);
      if (post === undefined) return;
      await sink.record({
        eventType: "commented",
        eventId: createDeterministicEventId(["commented", payload.commentId]),
        actorUserId: payload.authorId,
        occurredAt: clock.now(),
        payload: { postId: payload.postId, authorUserId: post.authorId, topics: post.topics },
      });
    }));

  subscribeToEvent(events, FollowedEvent, (payload) =>
    forwardSafely("followed", () =>
      sink.record({
        eventType: "followed",
        actorUserId: payload.followerId,
        occurredAt: clock.now(),
        payload: { targetAccountId: payload.targetId, targetKind: payload.targetType === "store" ? "store" : "user" },
      })));

  subscribeToEvent(events, OrderPaidEvent, (payload) =>
    forwardSafely("purchased", async () => {
      const items = await orderLookup.listAttributedOrderItems(payload.orderId);
      if (items.length === 0) return;
      await sink.record({
        eventType: "purchased",
        eventId: createDeterministicEventId(["purchased", payload.orderId]),
        actorUserId: payload.buyerId,
        occurredAt: clock.now(),
        payload: {
          orderId: payload.orderId,
          storeId: payload.storeId,
          items: items.slice(0, 200).map((item) => ({
            productId: item.productId,
            quantity: Math.max(1, item.quantity),
            unitPrice: { amountMinor: Math.floor(item.lineTotal / Math.max(1, item.quantity)), currency: item.currency },
          })),
        },
      });
    }));

  subscribeToEvent(events, LiveGiftSentEvent, (payload) =>
    forwardSafely("gift_sent", () =>
      sink.record({
        eventType: "gift_sent",
        eventId: createDeterministicEventId(["gift_sent", payload.giftId, payload.senderId, payload.liveSessionId, clock.now().toISOString()]),
        actorUserId: payload.senderId,
        occurredAt: clock.now(),
        payload: { giftId: payload.giftId, creatorUserId: payload.creatorId, coinAmount: Math.max(1, payload.quantity), hostContentId: payload.liveSessionId },
      })));
}
