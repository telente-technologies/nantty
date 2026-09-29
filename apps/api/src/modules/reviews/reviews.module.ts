import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { CreateReviewHandler } from "./commands/createReview/createReview.handler.js";
import { DeleteReviewHandler } from "./commands/deleteReview/deleteReview.handler.js";
import { ReplyToReviewHandler } from "./commands/replyToReview/replyToReview.handler.js";
import { GetRatingSummaryHandler } from "./queries/getRatingSummary/getRatingSummary.handler.js";
import { ListProductReviewsHandler } from "./queries/listProductReviews/listProductReviews.handler.js";
import { ListStoreReviewsHandler } from "./queries/listStoreReviews/listStoreReviews.handler.js";
import type { ReviewsService } from "./services/reviews.service.js";

export class ReviewsModule extends BaseModule {
  public readonly id = "reviews";
  public readonly name = "reviews";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("reviews module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("reviews module stopped");
  }
}

export function registerReviewsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, reviewsService: ReviewsService): void {
  registerCommandHandlers(commands, [
    new CreateReviewHandler(reviewsService),
    new ReplyToReviewHandler(reviewsService),
    new DeleteReviewHandler(reviewsService),
  ]);
  registerQueryHandlers(queries, [
    new GetRatingSummaryHandler(reviewsService),
    new ListProductReviewsHandler(reviewsService),
    new ListStoreReviewsHandler(reviewsService),
  ]);
}
