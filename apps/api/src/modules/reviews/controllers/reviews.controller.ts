import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { CreateReviewCommand } from "../commands/createReview/createReview.command.js";
import { DeleteReviewCommand } from "../commands/deleteReview/deleteReview.command.js";
import { ReplyToReviewCommand } from "../commands/replyToReview/replyToReview.command.js";
import type { ReviewDto } from "../dtos/reviews.dto.js";
import type { RatingSummary } from "../models/reviews.model.js";
import { GetRatingSummaryQuery } from "../queries/getRatingSummary/getRatingSummary.query.js";
import { ListProductReviewsQuery } from "../queries/listProductReviews/listProductReviews.query.js";
import { ListStoreReviewsQuery } from "../queries/listStoreReviews/listStoreReviews.query.js";
import { CreateReviewBodySchema, ReplyToReviewBodySchema, ReviewListQuerySchema, ReviewParamsSchema } from "../validators/reviews.validator.js";

export class ReviewsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly create = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ReviewParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = CreateReviewBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateReviewCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(201, await this.commands.execute<CreateReviewCommand, ReviewDto>(command));
  };

  public readonly reply = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ReviewParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ReplyToReviewBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ReplyToReviewCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.reply);
    return json(200, await this.commands.execute<ReplyToReviewCommand, ReviewDto>(command));
  };

  public readonly remove = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ReviewParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<DeleteReviewCommand, void>(new DeleteReviewCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  public readonly listForProduct = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ReviewParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = ReviewListQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListProductReviewsQuery(params.data.id, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListProductReviewsQuery, Page<ReviewDto>>(listQuery));
  };

  public readonly listForStore = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ReviewParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = ReviewListQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListStoreReviewsQuery(params.data.id, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListStoreReviewsQuery, Page<ReviewDto>>(listQuery));
  };

  public readonly ratingSummary = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ReviewParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute<GetRatingSummaryQuery, RatingSummary>(new GetRatingSummaryQuery(params.data.id)));
  };
}
