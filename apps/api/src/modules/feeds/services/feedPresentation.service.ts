import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { DiscoveryServices, SponsoredDto, SponsoredSurface } from "../../../interfaces/discovery.interface.js";
import type { UserDirectory, UserSummary } from "../../../interfaces/userDirectory.interface.js";
import { insertSponsoredItems } from "../../../utils/sponsoredInsertion.util.js";
import type { SocialProofBanner } from "../../intelligence/models/intelligenceRanking.model.js";
import type { PostRecord } from "../../posts/models/posts.model.js";
import type { SelectedFriendsLiked } from "../../posts/services/postPresenter.service.js";
import type { PostsService } from "../../posts/services/posts.service.js";
import type { FeedItemDto } from "../dtos/feeds.dto.js";

const SAMPLE_FRIENDS = 3;

export interface FeedPresentationInput {
  readonly posts: readonly PostRecord[];
  readonly viewerId: string;
  readonly displayCurrency: CurrencyCode;
  readonly socialProofByPostId: ReadonlyMap<string, SocialProofBanner>;
  readonly userIdByHash: ReadonlyMap<string, string>;
  readonly sponsoredSurface?: SponsoredSurface;
  readonly country: string | null;
}

export class FeedPresenter {
  public constructor(
    private readonly postsService: PostsService,
    private readonly userDirectory: UserDirectory,
    private readonly discovery: DiscoveryServices,
  ) {}

  public async presentFeedPage(input: FeedPresentationInput): Promise<FeedItemDto[]> {
    const friendsLiked = this.resolveSelectedFriends(input.socialProofByPostId, input.userIdByHash);
    const organic = await this.presentPostsWithSocialProof(input.posts, input.viewerId, input.displayCurrency, friendsLiked, new Map());
    if (input.sponsoredSurface === undefined) return organic;
    const sponsored = await this.presentSponsoredPosts(input, organic);
    return insertSponsoredItems(organic, sponsored);
  }

  private async presentSponsoredPosts(input: FeedPresentationInput, organic: readonly FeedItemDto[]): Promise<{ readonly position: number; readonly item: FeedItemDto }[]> {
    const insertions = await this.discovery.sponsoredContent.selectSponsoredItems({
      viewerId: input.viewerId,
      surface: input.sponsoredSurface ?? "feed",
      organicItems: organic.map((item) => ({ itemId: item.id, ...(item.author === null ? {} : { creatorUserId: item.author.id }) })),
      country: input.country,
    });
    const postInsertions = insertions.filter((insertion) => insertion.itemKind === "post" || insertion.itemKind === "clip");
    if (postInsertions.length === 0) return [];
    const organicIds = new Set(organic.map((item) => item.id));
    const now = this.postsService.dependencies.clock.now();
    const posts = (await this.postsService.dependencies.posts.findManyByIds(postInsertions.map((insertion) => insertion.itemId)))
      .filter((post) => post.deletedAt === null && (post.expiresAt === null || post.expiresAt > now) && !organicIds.has(post.id));
    const sponsoredByPostId = new Map<string, SponsoredDto>(postInsertions.map((insertion) => [insertion.itemId, insertion.sponsored]));
    const presented = new Map((await this.presentPostsWithSocialProof(posts, input.viewerId, input.displayCurrency, new Map(), sponsoredByPostId)).map((item) => [item.id, item]));
    return postInsertions.flatMap((insertion) => {
      const item = presented.get(insertion.itemId);
      return item === undefined ? [] : [{ position: insertion.position, item }];
    });
  }

  private resolveSelectedFriends(banners: ReadonlyMap<string, SocialProofBanner>, userIdByHash: ReadonlyMap<string, string>): Map<string, SelectedFriendsLiked> {
    const selections = new Map<string, SelectedFriendsLiked>();
    for (const [postId, banner] of banners) {
      const friendUserIds = banner.friendIds.map((hash) => userIdByHash.get(hash)).filter((id): id is string => id !== undefined);
      if (friendUserIds.length > 0) selections.set(postId, { totalFriendCount: Math.max(banner.totalFriendCount, friendUserIds.length), friendUserIds });
    }
    return selections;
  }

  private async presentPostsWithSocialProof(
    posts: readonly PostRecord[],
    viewerId: string,
    displayCurrency: CurrencyCode,
    friendsLiked: ReadonlyMap<string, SelectedFriendsLiked>,
    sponsored: ReadonlyMap<string, SponsoredDto>,
  ): Promise<FeedItemDto[]> {
    const presented = await this.postsService.presenter.presentPosts(posts, viewerId, displayCurrency, { friendsLiked, sponsored });
    const sampleIds = [...new Set([...friendsLiked.values()].flatMap((selection) => selection.friendUserIds.slice(0, SAMPLE_FRIENDS)))];
    const friends = new Map<string, UserSummary>((sampleIds.length === 0 ? [] : await this.userDirectory.findUserSummaries(sampleIds)).map((user) => [user.id, user]));
    return presented.map((post) => {
      const selection = friendsLiked.get(post.id);
      const sampleFriends = (selection?.friendUserIds ?? []).slice(0, SAMPLE_FRIENDS).map((id) => friends.get(id)).filter((user): user is UserSummary => user !== undefined);
      return { ...post, socialProof: { friendsLikedCount: selection?.totalFriendCount ?? 0, sampleFriends } };
    });
  }
}
