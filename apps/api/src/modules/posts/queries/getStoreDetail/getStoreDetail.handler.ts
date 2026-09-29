import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { Money, type MoneyDto } from "../../../../utils/money.util.js";
import type { PostDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { GetStoreDetailQuery } from "./getStoreDetail.query.js";

const RECENT_STORE_POST_COUNT = 12;

export interface StoreDetailDto {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly bio: string;
  readonly logoUrl: string | null;
  readonly bannerUrl: string | null;
  readonly rating: number;
  readonly ratingCount: number;
  readonly reviewCount: number;
  readonly followers: number;
  readonly isFollowing: boolean;
  readonly verified: boolean;
  readonly joinedAt: string;
  readonly currency: string;
  readonly shippingFee: MoneyDto;
  readonly posts: readonly PostDto[];
}

export class GetStoreDetailHandler extends QueryHandler<GetStoreDetailQuery, StoreDetailDto> {
  public readonly queryType = "posts.getStoreDetail" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: GetStoreDetailQuery): Promise<StoreDetailDto> {
    const { storeAccess, socialGraph, posts, clock, currencyConverter } = this.postsService.dependencies;
    const [store] = await storeAccess.findStoreSummaries([query.storeId]);
    if (store === undefined || store.status !== "active") throw notFound("Store");
    const blocked = query.viewerId === undefined ? [] : await socialGraph.listUserIdsBlockedEitherWay(query.viewerId);
    const recentPosts = await posts.listVisible({ storeIds: [store.id], kinds: ["post", "clip"], excludeAuthorIds: blocked }, clock.now(), { limit: RECENT_STORE_POST_COUNT });
    const convert = await currencyConverter.prepareConversionInto(query.displayCurrency);
    return {
      id: store.id,
      name: store.name,
      handle: store.slug,
      bio: store.description,
      logoUrl: store.logoUrl,
      bannerUrl: store.bannerUrl,
      rating: store.ratingAverage,
      ratingCount: store.ratingCount,
      reviewCount: store.ratingCount,
      followers: await socialGraph.countFollowers("store", store.id),
      isFollowing: query.viewerId === undefined ? false : await socialGraph.isFollowingStore(query.viewerId, store.id),
      verified: store.featured,
      joinedAt: store.createdAt.toISOString(),
      currency: store.currency,
      shippingFee: convert(Money.of(store.shippingFee, store.currency)).toDto(),
      posts: await this.postsService.presenter.presentPosts(recentPosts.data, query.viewerId, query.displayCurrency),
    };
  }
}
