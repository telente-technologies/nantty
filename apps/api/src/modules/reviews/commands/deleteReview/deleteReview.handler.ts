import { CommandHandler } from "@zudojs/cqrs";

import { forbidden } from "../../../../errors/domain.error.js";
import type { ReviewsService } from "../../services/reviews.service.js";
import type { DeleteReviewCommand } from "./deleteReview.command.js";

export class DeleteReviewHandler extends CommandHandler<DeleteReviewCommand, void> {
  public readonly commandType = "reviews.deleteReview" as const;

  public constructor(private readonly reviewsService: ReviewsService) {
    super();
  }

  public async execute(command: DeleteReviewCommand): Promise<void> {
    const review = await this.reviewsService.findReviewOrThrow(command.reviewId);
    if (review.userId !== command.principal.userId) throw forbidden("Only the author can delete this review.");
    await this.reviewsService.dependencies.reviews.delete(review.id);
    await this.reviewsService.recalculateRatings(review.productId, review.storeId);
  }
}
