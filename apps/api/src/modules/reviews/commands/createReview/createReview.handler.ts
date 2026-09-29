import { CommandHandler } from "@zudojs/cqrs";

import { NotificationRequestedEvent } from "../../../../events/notificationRequested.event.js";
import { forbidden } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import type { ReviewDto } from "../../dtos/reviews.dto.js";
import { ReviewCreatedEvent } from "../../events/reviewCreated.event.js";
import type { ReviewsService } from "../../services/reviews.service.js";
import type { CreateReviewCommand } from "./createReview.command.js";

export class CreateReviewHandler extends CommandHandler<CreateReviewCommand, ReviewDto> {
  public readonly commandType = "reviews.createReview" as const;

  public constructor(private readonly reviewsService: ReviewsService) {
    super();
  }

  public async execute(command: CreateReviewCommand): Promise<ReviewDto> {
    const { reviews, orderLookup, storeAccess, events, clock } = this.reviewsService.dependencies;
    const userId = command.principal.userId;
    const purchase = await orderLookup.hasReceivedProductInOrder(userId, command.input.orderId, command.productId);
    if (purchase === undefined) throw forbidden("Only buyers who received this product can review it.");
    const review = await reviews.create({
      productId: command.productId,
      storeId: purchase.storeId,
      orderId: command.input.orderId,
      userId,
      rating: command.input.rating,
      text: command.input.text?.trim() ?? "",
      createdAt: clock.now(),
    });
    await this.reviewsService.recalculateRatings(review.productId, review.storeId);
    await publishEvent(events, ReviewCreatedEvent, { reviewId: review.id, productId: review.productId, storeId: review.storeId, rating: review.rating });
    const [store] = await storeAccess.findStoreSummaries([review.storeId]);
    if (store !== undefined && store.ownerId !== userId) {
      await publishEvent(events, NotificationRequestedEvent, {
        userId: store.ownerId,
        category: "orders",
        title: "New review",
        body: `A buyer rated a product ${review.rating}/5.`,
        data: { type: "review", reviewId: review.id, productId: review.productId },
      });
    }
    const [dto] = await this.reviewsService.presentReviews([review]);
    return dto as ReviewDto;
  }
}
