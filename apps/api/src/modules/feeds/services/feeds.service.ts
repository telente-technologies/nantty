import { randomUUID } from "node:crypto";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { DiscoveryServices } from "../../../interfaces/discovery.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { paginateSortedItems } from "../../../utils/pagination.util.js";
import type { RepositorySocialGraph } from "../../follows/services/socialGraph.service.js";
import type { SocialProofBanner, ViewerContext } from "../../intelligence/models/intelligenceRanking.model.js";
import type { PostKind, PostRecord } from "../../posts/models/posts.model.js";
import type { PostsService } from "../../posts/services/posts.service.js";
import type { FeedItemDto } from "../dtos/feeds.dto.js";
import { FEED_HIDING_INTERACTION_KINDS } from "../models/feeds.model.js";
import type { FeedInteractionsRepository } from "../repositories/feeds.repository.js";
import { buildClipCandidates, buildFeedCandidates, buildViewerContext, orderPostsByRanking, type ViewerRelationships } from "./feedCandidates.service.js";
import { FeedPresenter } from "./feedPresentation.service.js";

const CANDIDATE_LIMIT = 500;
const CANDIDATE_WINDOW_DAYS = 14;
const RANKED_ITEM_LIMIT = 100;
const RECENT_INTERACTION_LIMIT = 500;
const SEEN_INTERACTION_KINDS = new Set(["view", "dwell", "watch"]);

export interface FeedsDependencies {
  readonly postsService: PostsService;
  readonly feedInteractions: FeedInteractionsRepository;
  readonly socialGraph: RepositorySocialGraph;
  readonly userDirectory: UserDirectory;
  readonly clock: Clock;
  readonly discovery: DiscoveryServices;
}

export interface FeedPage extends Page<FeedItemDto> {
  readonly rankingRequestId: string;
}

interface RankedPosts {
  readonly ordered: readonly PostRecord[];
  readonly socialProof: ReadonlyMap<string, SocialProofBanner>;
  readonly userIdByHash: ReadonlyMap<string, string>;
  readonly requestId: string;
}

export class FeedsService {
  public readonly presenter: FeedPresenter;

  public constructor(public readonly dependencies: FeedsDependencies) {
    this.presenter = new FeedPresenter(dependencies.postsService, dependencies.userDirectory, dependencies.discovery);
  }

  public async buildRankedFeed(
    viewerId: string,
    kinds: readonly PostKind[],
    topicId: string | undefined,
    page: PageRequest,
    displayCurrency: CurrencyCode,
    country: string | null = null,
  ): Promise<FeedPage> {
    const { postsService, userDirectory, clock } = this.dependencies;
    const now = clock.now();
    const topic = topicId === undefined ? undefined : ((await userDirectory.findTopicSlugById(topicId)) ?? topicId);
    const relationships = await this.loadViewerRelationships(viewerId);
    const state = await this.loadViewerFeedState(viewerId);
    const candidates = (await postsService.dependencies.posts.listRecentCandidates(
      {
        kinds,
        ...(topic === undefined ? {} : { topic }),
        excludeAuthorIds: relationships.blockedUserIds,
        createdAfter: new Date(now.getTime() - CANDIDATE_WINDOW_DAYS * 86_400_000),
      },
      now,
      CANDIDATE_LIMIT,
    )).filter((post) => !state.hiddenPostIds.has(post.id));
    const viewer = buildViewerContext(viewerId, country, relationships, state, this.dependencies.discovery.hasher);
    const onlyClips = kinds.length === 1 && kinds[0] === "clip";
    const ranked = onlyClips ? await this.rankClips(candidates, viewer, now) : await this.rankPosts(candidates, viewer, relationships, "for_you", now);
    const rankedPage = paginateSortedItems(ranked.ordered, page);
    const data = await this.presenter.presentFeedPage({
      posts: rankedPage.data,
      viewerId,
      displayCurrency,
      socialProofByPostId: ranked.socialProof,
      userIdByHash: ranked.userIdByHash,
      sponsoredSurface: onlyClips ? "clips" : "feed",
      country,
    });
    return { data, nextCursor: rankedPage.nextCursor, rankingRequestId: ranked.requestId };
  }

  public async buildFollowingFeed(viewerId: string, page: PageRequest, displayCurrency: CurrencyCode, country: string | null = null): Promise<FeedPage> {
    const { postsService, clock } = this.dependencies;
    const relationships = await this.loadViewerRelationships(viewerId);
    const state = await this.loadViewerFeedState(viewerId);
    const result = await postsService.dependencies.posts.listVisible(
      { authorIds: relationships.followedUserIds, storeIds: relationships.followedStoreIds, kinds: ["post", "clip"], excludeAuthorIds: relationships.blockedUserIds },
      clock.now(),
      page,
    );
    const viewer = buildViewerContext(viewerId, country, relationships, { ...state, seenPostIds: [] }, this.dependencies.discovery.hasher);
    const ranked = await this.rankPosts(result.data, viewer, relationships, "following", clock.now());
    const data = await this.presenter.presentFeedPage({
      posts: ranked.ordered,
      viewerId,
      displayCurrency,
      socialProofByPostId: ranked.socialProof,
      userIdByHash: ranked.userIdByHash,
      country,
    });
    return { data, nextCursor: result.nextCursor, rankingRequestId: ranked.requestId };
  }

  private async rankPosts(
    candidates: readonly PostRecord[],
    viewer: ViewerContext,
    relationships: ViewerRelationships,
    feedMode: "for_you" | "following",
    now: Date,
  ): Promise<RankedPosts> {
    const { postsService, userDirectory, discovery } = this.dependencies;
    const requestId = `feed_${randomUUID()}`;
    const friendLikers = relationships.followedUserIds.length === 0
      ? new Map<string, readonly string[]>()
      : await postsService.dependencies.interactions.listLikersAmongUsers(candidates.map((post) => post.id), relationships.followedUserIds);
    const authorIds = [...new Set(candidates.map((post) => post.authorId))];
    const authors = new Map((authorIds.length === 0 ? [] : await userDirectory.findUserSummaries(authorIds)).map((user) => [user.id, user]));
    const outcome = await discovery.ranking.rankFeed({
      requestId,
      feedMode,
      viewer,
      candidates: buildFeedCandidates(candidates, friendLikers, authors, discovery.hasher),
      limit: Math.min(RANKED_ITEM_LIMIT, Math.max(1, candidates.length)),
      options: { includeSocialProof: true },
      now: now.toISOString(),
    });
    const socialProof = new Map<string, SocialProofBanner>();
    for (const item of outcome.response.items) if (item.socialProof !== undefined && item.socialProof !== null) socialProof.set(item.itemId, item.socialProof);
    return {
      ordered: orderPostsByRanking(candidates, outcome.response.items.map((item) => item.itemId)),
      socialProof,
      userIdByHash: discovery.hasher.createUserIdLookup([...friendLikers.values()].flat()),
      requestId,
    };
  }

  private async rankClips(candidates: readonly PostRecord[], viewer: ViewerContext, now: Date): Promise<RankedPosts> {
    const requestId = `clips_${randomUUID()}`;
    const outcome = await this.dependencies.discovery.ranking.rankClips({
      requestId,
      viewer,
      candidates: buildClipCandidates(candidates, this.dependencies.discovery.hasher),
      limit: Math.min(RANKED_ITEM_LIMIT, Math.max(1, candidates.length)),
      now: now.toISOString(),
    });
    return { ordered: orderPostsByRanking(candidates, outcome.response.items.map((item) => item.itemId)), socialProof: new Map(), userIdByHash: new Map(), requestId };
  }

  private async loadViewerRelationships(viewerId: string): Promise<ViewerRelationships> {
    const { socialGraph } = this.dependencies;
    const [followedUserIds, followedStoreIds, blockedUserIds] = await Promise.all([
      socialGraph.listFollowedUserIds(viewerId),
      socialGraph.listFollowedStoreIds(viewerId),
      socialGraph.listUserIdsBlockedEitherWay(viewerId),
    ]);
    return { followedUserIds, followedStoreIds, blockedUserIds };
  }

  private async loadViewerFeedState(viewerId: string) {
    const interactions = await this.dependencies.feedInteractions.listRecentForUser(viewerId, RECENT_INTERACTION_LIMIT);
    return {
      hiddenPostIds: new Set(interactions.filter((interaction) => FEED_HIDING_INTERACTION_KINDS.includes(interaction.kind)).map((interaction) => interaction.postId)),
      seenPostIds: [...new Set(interactions.filter((interaction) => SEEN_INTERACTION_KINDS.has(interaction.kind)).map((interaction) => interaction.postId))],
      chosenTopics: await this.dependencies.userDirectory.listSelectedTopicSlugs(viewerId),
    };
  }
}
