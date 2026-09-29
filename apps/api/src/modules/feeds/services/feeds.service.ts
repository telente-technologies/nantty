import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { UserDirectory, UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { paginateSortedItems } from "../../../utils/pagination.util.js";
import type { RepositorySocialGraph } from "../../follows/services/socialGraph.service.js";
import type { PostKind, PostRecord } from "../../posts/models/posts.model.js";
import type { PostsService } from "../../posts/services/posts.service.js";
import type { FeedItemDto } from "../dtos/feeds.dto.js";
import { rankFeedPosts, type FeedRankingContext } from "../ranking/feedRanker.ranking.js";
import type { FeedInteractionsRepository } from "../repositories/feeds.repository.js";

const CANDIDATE_LIMIT = 500;
const CANDIDATE_WINDOW_DAYS = 14;
const SAMPLE_FRIENDS = 3;

export interface FeedsDependencies {
  readonly postsService: PostsService;
  readonly feedInteractions: FeedInteractionsRepository;
  readonly socialGraph: RepositorySocialGraph;
  readonly userDirectory: UserDirectory;
  readonly clock: Clock;
}

interface ViewerRelationships {
  readonly followedUserIds: readonly string[];
  readonly followedStoreIds: readonly string[];
  readonly blockedUserIds: readonly string[];
}

export class FeedsService {
  public constructor(public readonly dependencies: FeedsDependencies) {}

  public async buildRankedFeed(
    viewerId: string,
    kinds: readonly PostKind[],
    topicId: string | undefined,
    page: PageRequest,
    displayCurrency: CurrencyCode,
  ): Promise<Page<FeedItemDto>> {
    const { postsService, userDirectory, clock } = this.dependencies;
    const now = clock.now();
    const topic = topicId === undefined ? undefined : ((await userDirectory.findTopicSlugById(topicId)) ?? topicId);
    const relationships = await this.loadViewerRelationships(viewerId);
    const candidates = await postsService.dependencies.posts.listRecentCandidates(
      {
        kinds,
        ...(topic === undefined ? {} : { topic }),
        excludeAuthorIds: relationships.blockedUserIds,
        createdAfter: new Date(now.getTime() - CANDIDATE_WINDOW_DAYS * 86_400_000),
      },
      now,
      CANDIDATE_LIMIT,
    );
    const friendLikes = await postsService.dependencies.interactions.listLikersAmongUsers(
      candidates.map((post) => post.id),
      relationships.followedUserIds,
    );
    const context: FeedRankingContext = {
      now,
      followedUserIds: new Set(relationships.followedUserIds),
      followedStoreIds: new Set(relationships.followedStoreIds),
      preferredTopics: new Set(await userDirectory.listSelectedTopicSlugs(viewerId)),
      friendLikeCounts: new Map([...friendLikes].map(([postId, likers]) => [postId, likers.length])),
    };
    const rankedPage = paginateSortedItems(rankFeedPosts(candidates, context), page);
    return { data: await this.presentFeedItems(rankedPage.data, viewerId, friendLikes, displayCurrency), nextCursor: rankedPage.nextCursor };
  }

  public async buildFollowingFeed(viewerId: string, page: PageRequest, displayCurrency: CurrencyCode): Promise<Page<FeedItemDto>> {
    const { postsService, clock } = this.dependencies;
    const relationships = await this.loadViewerRelationships(viewerId);
    const result = await postsService.dependencies.posts.listVisible(
      {
        authorIds: relationships.followedUserIds,
        storeIds: relationships.followedStoreIds,
        kinds: ["post", "clip"],
        excludeAuthorIds: relationships.blockedUserIds,
      },
      clock.now(),
      page,
    );
    const friendLikes = await postsService.dependencies.interactions.listLikersAmongUsers(
      result.data.map((post) => post.id),
      relationships.followedUserIds,
    );
    return { data: await this.presentFeedItems(result.data, viewerId, friendLikes, displayCurrency), nextCursor: result.nextCursor };
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

  private async presentFeedItems(
    posts: readonly PostRecord[],
    viewerId: string,
    friendLikes: ReadonlyMap<string, readonly string[]>,
    displayCurrency: CurrencyCode,
  ): Promise<FeedItemDto[]> {
    const presented = await this.dependencies.postsService.presenter.presentPosts(posts, viewerId, displayCurrency);
    const sampleIds = [...new Set(posts.flatMap((post) => (friendLikes.get(post.id) ?? []).slice(0, SAMPLE_FRIENDS)))];
    const friends = new Map<string, UserSummary>(
      (sampleIds.length === 0 ? [] : await this.dependencies.userDirectory.findUserSummaries(sampleIds)).map((user) => [user.id, user]),
    );
    return presented.map((post) => {
      const likers = friendLikes.get(post.id) ?? [];
      const sampleFriends = likers
        .slice(0, SAMPLE_FRIENDS)
        .map((id) => friends.get(id))
        .filter((user): user is UserSummary => user !== undefined);
      return { ...post, socialProof: { friendsLikedCount: likers.length, sampleFriends } };
    });
  }
}
