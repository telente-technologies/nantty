import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import { Money } from "../../../utils/money.util.js";
import type {
  AuthorDto,
  CommentDto,
  LiveCommentDto,
  LiveSessionDto,
  PostDto,
  ProductCardDto,
  StoreBadgeDto,
  StoryTrayEntryDto,
} from "../dtos/posts.dto.js";
import type { CommentRecord, LiveCommentRecord, LiveSessionRecord, PostRecord } from "../models/posts.model.js";
import type { PostsDependencies } from "./posts.service.js";

const FRIEND_AVATAR_SAMPLE_SIZE = 3;

function convertStoreToBadge(store: StoreSummary | undefined): StoreBadgeDto | null {
  return store === undefined ? null : { id: store.id, name: store.name, slug: store.slug, logoUrl: store.logoUrl };
}

function convertUserToAuthor(user: UserSummary | undefined): AuthorDto | null {
  return user === undefined ? null : { id: user.id, name: user.name, username: user.username, avatarUrl: user.avatarUrl, verified: user.isSeller };
}

function indexById<T extends { readonly id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export class PostPresenter {
  public constructor(private readonly dependencies: PostsDependencies) {}

  public async presentPosts(posts: readonly PostRecord[], viewerId: string | undefined, displayCurrency: CurrencyCode): Promise<PostDto[]> {
    const { interactions, socialGraph, posts: postsRepository } = this.dependencies;
    const originalIds = [...new Set(posts.map((post) => post.repostOfId).filter((id): id is string => id !== null))];
    const originals = originalIds.length === 0 ? [] : await postsRepository.findManyByIds(originalIds);
    const everyPost = [...posts, ...originals];
    const postIds = everyPost.map((post) => post.id);
    const followedUserIds = viewerId === undefined ? [] : await socialGraph.listFollowedUserIds(viewerId);
    const [stores, products, liked, friendLikes] = await Promise.all([
      this.findStores(everyPost.map((post) => post.storeId).filter((id): id is string => id !== null)),
      this.findProductCards(everyPost.flatMap((post) => post.productIds), displayCurrency),
      viewerId === undefined ? new Set<string>() : interactions.listPostIdsLikedByUser(viewerId, postIds),
      followedUserIds.length === 0 ? new Map<string, readonly string[]>() : interactions.listLikersAmongUsers(postIds, followedUserIds),
    ]);
    const sampledFriendIds = [...friendLikes.values()].flatMap((likers) => likers.slice(0, FRIEND_AVATAR_SAMPLE_SIZE));
    const users = await this.findUsers([...everyPost.map((post) => post.authorId), ...sampledFriendIds]);
    const followed = new Set(followedUserIds);
    const presentOne = (post: PostRecord, repostOf: PostDto | null): PostDto => {
      const friendLikers = friendLikes.get(post.id) ?? [];
      return {
        id: post.id,
        kind: post.kind,
        author: convertUserToAuthor(users.get(post.authorId)),
        createdAt: post.createdAt.toISOString(),
        text: post.text,
        media: post.media,
        likes: post.likeCount,
        comments: post.commentCount,
        reposts: post.repostCount,
        shares: post.shareCount,
        views: post.viewCount,
        liked: liked.has(post.id),
        bookmarked: false,
        isFollowingAuthor: followed.has(post.authorId),
        friendsLiked:
          friendLikers.length === 0
            ? null
            : { count: friendLikers.length, avatars: friendLikers.slice(0, FRIEND_AVATAR_SAMPLE_SIZE).map((id) => users.get(id)?.avatarUrl ?? null) },
        products: post.productIds.map((id) => products.get(id)).filter((product): product is ProductCardDto => product !== undefined),
        store: convertStoreToBadge(post.storeId === null ? undefined : stores.get(post.storeId)),
        topics: post.topics,
        audience: post.audience,
        repostOf,
        expiresAt: post.expiresAt?.toISOString() ?? null,
      };
    };
    const originalsById = indexById(originals);
    return posts.map((post) => {
      const original = post.repostOfId === null ? undefined : originalsById.get(post.repostOfId);
      return presentOne(post, original !== undefined && original.deletedAt === null ? presentOne(original, null) : null);
    });
  }

  public async presentComments(comments: readonly CommentRecord[], viewerId: string | undefined): Promise<CommentDto[]> {
    const { engagement } = this.dependencies;
    const commentIds = comments.map((comment) => comment.id);
    const [authors, likeCounts, liked] = await Promise.all([
      this.findUsers(comments.map((comment) => comment.authorId)),
      engagement.countLikesForComments(commentIds),
      viewerId === undefined ? new Set<string>() : engagement.listCommentIdsLikedByUser(viewerId, commentIds),
    ]);
    return comments.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      replyToCommentId: comment.parentId,
      text: comment.text,
      author: convertUserToAuthor(authors.get(comment.authorId)),
      likes: likeCounts.get(comment.id) ?? comment.likeCount,
      liked: liked.has(comment.id),
      createdAt: comment.createdAt.toISOString(),
    }));
  }

  public async presentStoryTray(stories: readonly PostRecord[], viewerId: string | undefined): Promise<StoryTrayEntryDto[]> {
    const seen = viewerId === undefined ? new Set<string>() : await this.dependencies.engagement.listStoryIdsSeenByUser(viewerId, stories.map((story) => story.id));
    const authors = await this.findUsers(stories.map((story) => story.authorId));
    const byAuthor = new Map<string, PostRecord[]>();
    for (const story of [...stories].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
      byAuthor.set(story.authorId, [...(byAuthor.get(story.authorId) ?? []), story]);
    }
    const entries = [...byAuthor.entries()].map(([authorId, authorStories]) => ({
      author: convertUserToAuthor(authors.get(authorId)),
      hasUnseen: authorStories.some((story) => !seen.has(story.id)),
      latestStoryAt: (authorStories.at(-1)?.createdAt ?? new Date(0)).toISOString(),
      stories: authorStories.map((story) => ({
        id: story.id,
        media: story.media,
        text: story.text,
        seen: seen.has(story.id),
        createdAt: story.createdAt.toISOString(),
        expiresAt: story.expiresAt?.toISOString() ?? null,
      })),
    }));
    return entries.sort((left, right) => {
      if (left.author?.id === viewerId) return -1;
      if (right.author?.id === viewerId) return 1;
      if (left.hasUnseen !== right.hasUnseen) return left.hasUnseen ? -1 : 1;
      return right.latestStoryAt.localeCompare(left.latestStoryAt);
    });
  }

  public async presentLiveSessions(sessions: readonly LiveSessionRecord[], displayCurrency: CurrencyCode): Promise<LiveSessionDto[]> {
    const [hosts, stores, products] = await Promise.all([
      this.findUsers(sessions.map((session) => session.hostId)),
      this.findStores(sessions.map((session) => session.storeId).filter((id): id is string => id !== null)),
      this.findProductCards(sessions.flatMap((session) => session.productIds), displayCurrency),
    ]);
    return sessions.map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status,
      host: convertUserToAuthor(hosts.get(session.hostId)),
      store: convertStoreToBadge(session.storeId === null ? undefined : stores.get(session.storeId)),
      viewerCount: session.viewerCount,
      reactionCount: session.reactionCount,
      products: session.productIds.map((id) => products.get(id)).filter((product): product is ProductCardDto => product !== undefined),
      pinnedProduct: session.pinnedProductId === null ? null : products.get(session.pinnedProductId) ?? null,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
    }));
  }

  public async presentLiveComments(comments: readonly LiveCommentRecord[]): Promise<LiveCommentDto[]> {
    const authors = await this.findUsers(comments.map((comment) => comment.userId));
    return comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      author: convertUserToAuthor(authors.get(comment.userId)),
      createdAt: comment.createdAt.toISOString(),
    }));
  }

  private async findUsers(userIds: readonly string[]): Promise<Map<string, UserSummary>> {
    const unique = [...new Set(userIds)];
    return indexById(unique.length === 0 ? [] : await this.dependencies.userDirectory.findUserSummaries(unique));
  }

  private async findStores(storeIds: readonly string[]): Promise<Map<string, StoreSummary>> {
    const unique = [...new Set(storeIds)];
    return indexById(unique.length === 0 ? [] : await this.dependencies.storeAccess.findStoreSummaries(unique));
  }

  private async findProductCards(productIds: readonly string[], displayCurrency: CurrencyCode): Promise<Map<string, ProductCardDto>> {
    const unique = [...new Set(productIds)];
    if (unique.length === 0) return new Map();
    const products = await this.dependencies.productCatalog.findProductSummaries(unique);
    if (products.length === 0) return new Map();
    const convertIntoDisplayCurrency = await this.dependencies.currencyConverter.prepareConversionInto(displayCurrency);
    const convertPrice = (amountMinor: number, currency: CurrencyCode) => convertIntoDisplayCurrency(Money.of(amountMinor, currency)).toDto();
    return indexById(
      products.map((product) => ({
        id: product.id,
        name: product.title,
        storeId: product.storeId,
        price: convertPrice(product.price, product.currency),
        compareAtPrice: product.compareAtPrice === null ? null : convertPrice(product.compareAtPrice, product.currency),
        imageUrl: product.imageUrl,
        rating: product.ratingAverage,
        ratingCount: product.ratingCount,
      })),
    );
  }
}
