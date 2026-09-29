import type { EventBus } from "@zudojs/events";

import { notFound } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { OrderLookup } from "../../../interfaces/orderLookup.interface.js";
import type { ProductCatalog } from "../../../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { ReviewDto } from "../dtos/reviews.dto.js";
import type { ReviewRecord } from "../models/reviews.model.js";
import type { ReviewsRepository } from "../repositories/reviews.repository.js";

export interface ReviewsDependencies {
  readonly reviews: ReviewsRepository;
  readonly orderLookup: OrderLookup;
  readonly productCatalog: ProductCatalog;
  readonly storeAccess: StoreAccess;
  readonly userDirectory: UserDirectory;
  readonly events: EventBus;
  readonly clock: Clock;
}

export class ReviewsService {
  public constructor(public readonly dependencies: ReviewsDependencies) {}

  public async findReviewOrThrow(reviewId: string): Promise<ReviewRecord> {
    const review = await this.dependencies.reviews.findById(reviewId);
    if (review === undefined) throw notFound("Review");
    return review;
  }

  public async recalculateRatings(productId: string, storeId: string): Promise<void> {
    const { reviews, productCatalog, storeAccess } = this.dependencies;
    const productSummary = await reviews.summarize({ productId });
    await productCatalog.updateProductRating(productId, productSummary.average, productSummary.count);
    const storeSummary = await reviews.summarize({ storeId });
    await storeAccess.updateStoreRating(storeId, storeSummary.average, storeSummary.count);
  }

  public async presentReviews(reviews: readonly ReviewRecord[]): Promise<ReviewDto[]> {
    const userIds = [...new Set(reviews.map((review) => review.userId))];
    const authors = new Map((userIds.length === 0 ? [] : await this.dependencies.userDirectory.findUserSummaries(userIds)).map((user) => [user.id, user]));
    return reviews.map((review) => ({
      id: review.id,
      productId: review.productId,
      storeId: review.storeId,
      rating: review.rating,
      text: review.text,
      author: authors.get(review.userId) ?? null,
      reply: review.reply,
      repliedAt: review.repliedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
    }));
  }
}
