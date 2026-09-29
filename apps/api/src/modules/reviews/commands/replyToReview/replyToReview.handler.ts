import { CommandHandler } from "@zudojs/cqrs";

import { NotificationRequestedEvent } from "../../../../events/notificationRequested.event.js";
import { notFound } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import type { ReviewDto } from "../../dtos/reviews.dto.js";
import type { ReviewsService } from "../../services/reviews.service.js";
import type { ReplyToReviewCommand } from "./replyToReview.command.js";

export class ReplyToReviewHandler extends CommandHandler<ReplyToReviewCommand, ReviewDto> {
  public readonly commandType = "reviews.replyToReview" as const;

  public constructor(private readonly reviewsService: ReviewsService) {
    super();
  }

  public async execute(command: ReplyToReviewCommand): Promise<ReviewDto> {
    const { reviews, storeAccess, events, clock } = this.reviewsService.dependencies;
    const review = await this.reviewsService.findReviewOrThrow(command.reviewId);
    await storeAccess.assertStoreMember(command.principal.userId, review.storeId);
    const updated = await reviews.saveReply(review.id, command.reply.trim(), clock.now());
    if (updated === undefined) throw notFound("Review");
    await publishEvent(events, NotificationRequestedEvent, {
      userId: review.userId,
      category: "orders",
      title: "The seller replied to your review",
      body: updated.reply ?? "",
      data: { type: "review_reply", reviewId: review.id, productId: review.productId },
    });
    const [dto] = await this.reviewsService.presentReviews([updated]);
    return dto as ReviewDto;
  }
}
