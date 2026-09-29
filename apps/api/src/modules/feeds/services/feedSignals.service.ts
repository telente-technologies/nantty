import { notFound } from "../../../errors/domain.error.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { ProductCatalog } from "../../../interfaces/productCatalog.interface.js";
import type { FeedsService } from "./feeds.service.js";
import type { FeedInteractionKind, FeedInteractionSignals, ProductInteractionSignal } from "../models/feeds.model.js";

const MAXIMUM_DWELL_MS = 3_600_000;

export type FeedFeedbackType = "hide" | "not_interested";

function clampWholeNumber(value: number | undefined, maximum: number): number {
  return Math.min(maximum, Math.max(0, Math.round(value ?? 0)));
}

export class FeedSignalsService {
  public constructor(private readonly feedsService: FeedsService, private readonly productCatalog: ProductCatalog) {}

  public async recordInteraction(principal: Principal, postId: string, kind: FeedInteractionKind, signals: FeedInteractionSignals, country: string | null): Promise<void> {
    const { postsService, feedInteractions, clock, discovery } = this.feedsService.dependencies;
    const post = await postsService.findVisiblePostOrThrow(postId, principal.userId);
    const now = clock.now();
    await feedInteractions.record(principal.userId, post.id, kind, now);
    if (kind === "view") await postsService.dependencies.posts.changeCounter(post.id, "viewCount", 1);
    if (kind === "share") await postsService.dependencies.posts.changeCounter(post.id, "shareCount", 1);
    const context = {
      ...(signals.surface === undefined ? {} : { surface: signals.surface }),
      ...(signals.rankingRequestId === undefined ? {} : { rankingRequestId: signals.rankingRequestId }),
      ...(signals.deviceClass === undefined ? {} : { deviceClass: signals.deviceClass }),
    };
    const base = { actorUserId: principal.userId, occurredAt: now, country, context };
    const topics = { topics: post.topics };
    if (kind === "view" || kind === "dwell") {
      await discovery.eventSink.record({
        ...base,
        eventType: "post_viewed",
        payload: {
          ...topics,
          postId: post.id,
          authorUserId: post.authorId,
          dwellMs: clampWholeNumber(signals.dwellMs, MAXIMUM_DWELL_MS),
          ...(signals.position === undefined ? {} : { position: clampWholeNumber(signals.position, 10_000) }),
          isProductPost: post.productIds.length > 0,
        },
      });
    } else if (kind === "watch") {
      await discovery.eventSink.record({
        ...base,
        eventType: "clip_watched",
        payload: {
          ...topics,
          clipId: post.id,
          creatorUserId: post.authorId,
          watchFraction: Math.min(1, Math.max(0, signals.watchFraction ?? 0)),
          loopCount: clampWholeNumber(signals.loopCount, 100),
          durationMs: clampWholeNumber(signals.durationMs, MAXIMUM_DWELL_MS),
        },
      });
    } else if (kind === "share") {
      await discovery.eventSink.record({ ...base, eventType: "shared", payload: { ...topics, postId: post.id, authorUserId: post.authorId, channel: "in_app" } });
    }
  }

  public async recordProductInteraction(principal: Principal, signal: ProductInteractionSignal, country: string | null): Promise<void> {
    const [product] = await this.productCatalog.findProductSummaries([signal.productId]);
    if (product === undefined || !product.published) throw notFound("Product");
    const { discovery, clock } = this.feedsService.dependencies;
    const base = { actorUserId: principal.userId, occurredAt: clock.now(), country };
    const sourcePost = signal.sourcePostId === undefined ? {} : { sourcePostId: signal.sourcePostId };
    if (signal.kind === "product_view") {
      await discovery.eventSink.record({
        ...base,
        eventType: "product_viewed",
        payload: { productId: product.id, storeId: product.storeId, price: { amountMinor: product.price, currency: product.currency }, ...sourcePost },
      });
      return;
    }
    await discovery.eventSink.record({
      ...base,
      eventType: "added_to_cart",
      payload: { productId: product.id, storeId: product.storeId, quantity: Math.min(10_000, Math.max(1, signal.quantity ?? 1)), ...sourcePost },
    });
  }

  public async recordFeedback(principal: Principal, postId: string, type: FeedFeedbackType, country: string | null): Promise<void> {
    const { postsService, feedInteractions, clock, discovery } = this.feedsService.dependencies;
    const post = await postsService.findVisiblePostOrThrow(postId, principal.userId);
    const now = clock.now();
    await feedInteractions.record(principal.userId, post.id, type, now);
    await discovery.eventSink.record({
      eventType: "hidden",
      actorUserId: principal.userId,
      occurredAt: now,
      country,
      context: { surface: type },
      payload: { targetId: post.id, targetType: post.kind === "clip" ? "clip" : "post", targetAuthorUserId: post.authorId, topics: post.topics },
    });
  }
}
