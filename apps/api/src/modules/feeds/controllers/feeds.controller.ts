import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { RecordFeedInteractionCommand } from "../commands/recordFeedInteraction/recordFeedInteraction.command.js";
import type { FeedItemDto } from "../dtos/feeds.dto.js";
import { GetFollowingFeedQuery } from "../queries/getFollowingFeed/getFollowingFeed.query.js";
import { GetForYouFeedQuery } from "../queries/getForYouFeed/getForYouFeed.query.js";
import { GetSuggestedClipsQuery } from "../queries/getSuggestedClips/getSuggestedClips.query.js";
import { FeedInteractionBodySchema, FeedQuerySchema } from "../validators/feeds.validator.js";

export class FeedsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly forYou = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = FeedQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { topic, ...pageQuery } = query.data;
    const feedQuery = new GetForYouFeedQuery(requireAuthenticatedPrincipal(ctx), topic, buildPageRequest(pageQuery));
    return json(200, await this.queries.execute<GetForYouFeedQuery, Page<FeedItemDto>>(feedQuery));
  };

  public readonly following = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = FeedQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { topic: _topic, ...pageQuery } = query.data;
    const feedQuery = new GetFollowingFeedQuery(requireAuthenticatedPrincipal(ctx), buildPageRequest(pageQuery));
    return json(200, await this.queries.execute<GetFollowingFeedQuery, Page<FeedItemDto>>(feedQuery));
  };

  public readonly clips = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = FeedQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { topic, ...pageQuery } = query.data;
    const feedQuery = new GetSuggestedClipsQuery(requireAuthenticatedPrincipal(ctx), topic, buildPageRequest(pageQuery));
    return json(200, await this.queries.execute<GetSuggestedClipsQuery, Page<FeedItemDto>>(feedQuery));
  };

  public readonly recordInteraction = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = FeedInteractionBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new RecordFeedInteractionCommand(requireAuthenticatedPrincipal(ctx), body.data.postId, body.data.kind);
    await this.commands.execute<RecordFeedInteractionCommand, void>(command);
    return empty(204);
  };
}
