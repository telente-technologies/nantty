import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { RecordFeedFeedbackCommand } from "../commands/recordFeedFeedback/recordFeedFeedback.command.js";
import { RecordFeedInteractionCommand } from "../commands/recordFeedInteraction/recordFeedInteraction.command.js";
import { RecordProductInteractionCommand } from "../commands/recordProductInteraction/recordProductInteraction.command.js";
import type { FeedInteractionSignals } from "../models/feeds.model.js";
import { GetFollowingFeedQuery } from "../queries/getFollowingFeed/getFollowingFeed.query.js";
import { GetForYouFeedQuery } from "../queries/getForYouFeed/getForYouFeed.query.js";
import { GetSuggestedClipsQuery } from "../queries/getSuggestedClips/getSuggestedClips.query.js";
import { GetTrendingQuery } from "../queries/getTrending/getTrending.query.js";
import type { FeedPage } from "../services/feeds.service.js";
import type { TrendingResultDto } from "../services/trending.service.js";
import { ClipsQuerySchema, FeedFeedbackBodySchema, FeedInteractionBodySchema, FeedQuerySchema, TrendingQuerySchema, type FeedInteractionBody } from "../validators/feeds.validator.js";

const SUGGESTED_CLIP_COUNT = 10;
const DEFAULT_TRENDING_COUNT = 20;

function readInteractionSignals(body: FeedInteractionBody): FeedInteractionSignals {
  const { dwellMs, watchFraction, loopCount, durationMs, position, surface, rankingRequestId, deviceClass } = body;
  return Object.fromEntries(
    Object.entries({ dwellMs, watchFraction, loopCount, durationMs, position, surface, rankingRequestId, deviceClass }).filter(([, value]) => value !== undefined),
  ) as FeedInteractionSignals;
}

export class FeedsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly forYou = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = FeedQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { topicId, ...pageQuery } = query.data;
    const locale = findViewerLocale(ctx);
    const feedQuery = new GetForYouFeedQuery(requireAuthenticatedPrincipal(ctx), topicId, buildPageRequest(pageQuery), locale.currency, locale.countryCode);
    return json(200, await this.queries.execute<GetForYouFeedQuery, FeedPage>(feedQuery));
  };

  public readonly following = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = FeedQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { topicId: _topicId, ...pageQuery } = query.data;
    const locale = findViewerLocale(ctx);
    const feedQuery = new GetFollowingFeedQuery(requireAuthenticatedPrincipal(ctx), buildPageRequest(pageQuery), locale.currency, locale.countryCode);
    return json(200, await this.queries.execute<GetFollowingFeedQuery, FeedPage>(feedQuery));
  };

  public readonly suggestedClips = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const locale = findViewerLocale(ctx);
    const feedQuery = new GetSuggestedClipsQuery(requireAuthenticatedPrincipal(ctx), undefined, { limit: SUGGESTED_CLIP_COUNT }, locale.currency, locale.countryCode);
    const clips = await this.queries.execute<GetSuggestedClipsQuery, FeedPage>(feedQuery);
    return json(200, clips.data.map((clip) => ({ id: clip.id, thumbnailUrl: (clip.media.find((item) => item.type === "image") ?? clip.media[0])?.url ?? null })));
  };

  public readonly clips = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ClipsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { tab, ...pageQuery } = query.data;
    const principal = requireAuthenticatedPrincipal(ctx);
    const locale = findViewerLocale(ctx);
    if (tab === "following") {
      const page = await this.queries.execute<GetFollowingFeedQuery, FeedPage>(new GetFollowingFeedQuery(principal, buildPageRequest(pageQuery), locale.currency, locale.countryCode));
      return json(200, { ...page, data: page.data.filter((post) => post.kind === "clip") });
    }
    const feedQuery = new GetSuggestedClipsQuery(principal, undefined, buildPageRequest(pageQuery), locale.currency, locale.countryCode);
    return json(200, await this.queries.execute<GetSuggestedClipsQuery, FeedPage>(feedQuery));
  };

  public readonly recordInteraction = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = FeedInteractionBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const principal = requireAuthenticatedPrincipal(ctx);
    const country = findViewerLocale(ctx).countryCode;
    const { kind, postId, productId } = body.data;
    if (kind === "product_view" || kind === "add_to_cart") {
      if (productId === undefined) return json(400, { message: "productId is required for product interactions.", code: "VALIDATION_FAILED" });
      const signal = { productId, kind, ...(body.data.quantity === undefined ? {} : { quantity: body.data.quantity }), ...(body.data.sourcePostId === undefined ? {} : { sourcePostId: body.data.sourcePostId }) };
      await this.commands.execute<RecordProductInteractionCommand, void>(new RecordProductInteractionCommand(principal, signal, country));
      return empty(204);
    }
    if (postId === undefined) return json(400, { message: "postId is required for post interactions.", code: "VALIDATION_FAILED" });
    const command = new RecordFeedInteractionCommand(principal, postId, kind, readInteractionSignals(body.data), country);
    await this.commands.execute<RecordFeedInteractionCommand, void>(command);
    return empty(204);
  };

  public readonly recordFeedback = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = FeedFeedbackBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new RecordFeedFeedbackCommand(requireAuthenticatedPrincipal(ctx), body.data.postId, body.data.type, findViewerLocale(ctx).countryCode);
    await this.commands.execute<RecordFeedFeedbackCommand, void>(command);
    return empty(204);
  };

  public readonly trending = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = TrendingQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const locale = findViewerLocale(ctx);
    const trendingQuery = new GetTrendingQuery(requireAuthenticatedPrincipal(ctx), query.data.kind ?? "hashtag", locale.countryCode, query.data.limit ?? DEFAULT_TRENDING_COUNT, locale.currency);
    return json(200, await this.queries.execute<GetTrendingQuery, TrendingResultDto>(trendingQuery));
  };
}
