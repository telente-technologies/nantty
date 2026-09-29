import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import { Money } from "../../../utils/money.util.js";
import type { CommentDto, LiveCommentDto, LiveSessionDto, PostDto, ProductCardDto, StoreBadgeDto } from "../dtos/posts.dto.js";
import type { CommentRecord, LiveCommentRecord, LiveSessionRecord, PostRecord } from "../models/posts.model.js";
import type { PostsDependencies } from "./posts.service.js";

function convertStoreToBadge(store: StoreSummary | undefined): StoreBadgeDto | null {
  return store === undefined ? null : { id: store.id, name: store.name, slug: store.slug, logoUrl: store.logoUrl };
}

function indexById<T extends { readonly id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export class PostPresenter {
  public constructor(private readonly dependencies: PostsDependencies) {}

  public async presentPosts(posts: readonly PostRecord[], viewerId: string | undefined, displayCurrency: CurrencyCode): Promise<PostDto[]> {
    const originalIds = [...new Set(posts.map((post) => post.repostOfId).filter((id): id is string => id !== null))];
    const originals = originalIds.length === 0 ? [] : await this.dependencies.posts.findManyByIds(originalIds);
    const everyPost = [...posts, ...originals];
    const [authors, stores, products, liked] = await Promise.all([
      this.findUsers(everyPost.map((post) => post.authorId)),
      this.findStores(everyPost.map((post) => post.storeId).filter((id): id is string => id !== null)),
      this.findProductCards(everyPost.flatMap((post) => post.productIds), displayCurrency),
      viewerId === undefined ? new Set<string>() : this.dependencies.interactions.listPostIdsLikedByUser(viewerId, everyPost.map((post) => post.id)),
    ]);
    const presentOne = (post: PostRecord, repostOf: PostDto | null): PostDto => ({
      id: post.id,
      kind: post.kind,
      text: post.text,
      media: post.media,
      audience: post.audience,
      topics: post.topics,
      author: authors.get(post.authorId) ?? null,
      store: convertStoreToBadge(post.storeId === null ? undefined : stores.get(post.storeId)),
      taggedProducts: post.productIds.map((id) => products.get(id)).filter((product): product is ProductCardDto => product !== undefined),
      repostOf,
      counts: { likes: post.likeCount, comments: post.commentCount, reposts: post.repostCount, shares: post.shareCount, views: post.viewCount },
      likedByMe: liked.has(post.id),
      expiresAt: post.expiresAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
    });
    const originalsById = indexById(originals);
    return posts.map((post) => {
      const original = post.repostOfId === null ? undefined : originalsById.get(post.repostOfId);
      const visibleOriginal = original !== undefined && original.deletedAt === null ? presentOne(original, null) : null;
      return presentOne(post, visibleOriginal);
    });
  }

  public async presentComments(comments: readonly CommentRecord[]): Promise<CommentDto[]> {
    const authors = await this.findUsers(comments.map((comment) => comment.authorId));
    return comments.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      text: comment.text,
      author: authors.get(comment.authorId) ?? null,
      createdAt: comment.createdAt.toISOString(),
    }));
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
      host: hosts.get(session.hostId) ?? null,
      store: convertStoreToBadge(session.storeId === null ? undefined : stores.get(session.storeId)),
      viewerCount: session.viewerCount,
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
      author: authors.get(comment.userId) ?? null,
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
        storeId: product.storeId,
        title: product.title,
        price: convertPrice(product.price, product.currency),
        compareAtPrice: product.compareAtPrice === null ? null : convertPrice(product.compareAtPrice, product.currency),
        imageUrl: product.imageUrl,
        ratingAverage: product.ratingAverage,
        ratingCount: product.ratingCount,
      })),
    );
  }
}
