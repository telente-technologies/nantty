import type { EventBus } from "@zudojs/events";

import { NotificationRequestedEvent, type NotificationRequestedPayload } from "../../../events/notificationRequested.event.js";
import { forbidden, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { CreatorAccess } from "../../../interfaces/creatorAccess.interface.js";
import type { CreatorSubscriberLookup } from "../../../interfaces/creatorSubscriberLookup.interface.js";
import type { CurrencyConverter } from "../../../interfaces/currencyConverter.interface.js";
import type { MediaLibrary } from "../../../interfaces/mediaLibrary.interface.js";
import type { ProductCatalog, ProductSummary } from "../../../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { RepositorySocialGraph } from "../../follows/services/socialGraph.service.js";
import type { CommentRecord, LiveSessionRecord, PostRecord } from "../models/posts.model.js";
import type { LiveSessionsRepository } from "../repositories/live.repository.js";
import type { SocialEngagementRepository } from "../repositories/socialEngagement.repository.js";
import type { PostInteractionsRepository } from "../repositories/postInteractions.repository.js";
import { isPostVisibleAt, type PostsRepository } from "../repositories/posts.repository.js";
import { CommentPresenter } from "./commentPresenter.service.js";
import { PostPresenter } from "./postPresenter.service.js";

export interface PostsDependencies {
  readonly posts: PostsRepository;
  readonly interactions: PostInteractionsRepository;
  readonly engagement: SocialEngagementRepository;
  readonly liveSessions: LiveSessionsRepository;
  readonly userDirectory: UserDirectory;
  readonly productCatalog: ProductCatalog;
  readonly storeAccess: StoreAccess;
  readonly socialGraph: RepositorySocialGraph;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly currencyConverter: CurrencyConverter;
  readonly creatorAccess: CreatorAccess;
  readonly mediaLibrary: MediaLibrary;
  readonly subscriberLookup?: CreatorSubscriberLookup;
}

export class PostsService {
  public readonly presenter: PostPresenter;
  public readonly commentPresenter: CommentPresenter;

  public constructor(public readonly dependencies: PostsDependencies) {
    this.presenter = new PostPresenter(dependencies);
    this.commentPresenter = new CommentPresenter(dependencies, this.presenter);
  }

  public async findVisiblePostOrThrow(postId: string, viewerId: string | undefined): Promise<PostRecord> {
    const post = await this.dependencies.posts.findById(postId);
    if (post === undefined || !isPostVisibleAt(post, this.dependencies.clock.now())) throw notFound("Post");
    if (viewerId !== undefined && viewerId !== post.authorId && (await this.dependencies.socialGraph.isBlockedEitherWay(viewerId, post.authorId))) {
      throw notFound("Post");
    }
    return post;
  }

  public async findCommentOnVisiblePostOrThrow(commentId: string, viewerId: string | undefined): Promise<{ readonly comment: CommentRecord; readonly post: PostRecord }> {
    const comment = await this.dependencies.interactions.findComment(commentId);
    if (comment === undefined) throw notFound("Comment");
    return { comment, post: await this.findVisiblePostOrThrow(comment.postId, viewerId) };
  }

  public async assertUsersAreNotBlocked(userId: string, otherUserId: string): Promise<void> {
    if (userId !== otherUserId && (await this.dependencies.socialGraph.isBlockedEitherWay(userId, otherUserId))) {
      throw forbidden("You cannot interact with this user.");
    }
  }

  public async findPublishedProductsOrThrow(productIds: readonly string[]): Promise<readonly ProductSummary[]> {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length === 0) return [];
    const products = await this.dependencies.productCatalog.findProductSummaries(uniqueIds);
    const published = products.filter((product) => product.published);
    if (published.length !== uniqueIds.length) throw unprocessable("Tagged products must exist and be published.");
    return published;
  }

  public async findLiveSessionOrThrow(sessionId: string): Promise<LiveSessionRecord> {
    const session = await this.dependencies.liveSessions.findById(sessionId);
    if (session === undefined) throw notFound("Live session");
    return session;
  }

  public async findActiveLiveSessionOrThrow(sessionId: string, viewerId: string): Promise<LiveSessionRecord> {
    const session = await this.findLiveSessionOrThrow(sessionId);
    if (session.status !== "live") throw unprocessable("This live session has ended.");
    await this.assertUsersAreNotBlocked(viewerId, session.hostId);
    await this.assertCanWatchSubscriberOnlyLive(session, viewerId);
    return session;
  }

  public async assertCanWatchSubscriberOnlyLive(session: LiveSessionRecord, viewerId: string): Promise<void> {
    if (session.visibility !== "subscribers" || session.hostId === viewerId) return;
    const subscribed = (await this.dependencies.subscriberLookup?.listCreatorIdsViewerSubscribesTo(viewerId, [session.hostId])) ?? new Set<string>();
    if (!subscribed.has(session.hostId)) throw forbidden("This live is for subscribers only. Subscribe to watch.");
  }

  public async assertIsApprovedLiveHost(session: LiveSessionRecord, userId: string): Promise<void> {
    if (session.hostId !== userId) throw forbidden("Only the host can manage this live session.");
    await this.dependencies.creatorAccess.assertApprovedCreator(userId);
  }

  public async notifyUserUnlessSelf(actorId: string, payload: NotificationRequestedPayload): Promise<void> {
    if (payload.userId === actorId) return;
    await publishEvent(this.dependencies.events, NotificationRequestedEvent, payload);
  }

  public async findActorUsername(userId: string): Promise<string> {
    const [actor] = await this.dependencies.userDirectory.findUserSummaries([userId]);
    return actor === undefined ? "Someone" : `@${actor.username}`;
  }
}
