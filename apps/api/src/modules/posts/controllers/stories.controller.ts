import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { CreatePostCommand } from "../commands/createPost/createPost.command.js";
import { MarkStorySeenCommand } from "../commands/markStorySeen/markStorySeen.command.js";
import { ReplyToStoryCommand } from "../commands/replyToStory/replyToStory.command.js";
import type { PostDto, StoryTrayEntryDto } from "../dtos/posts.dto.js";
import { ListActiveStoriesQuery } from "../queries/listActiveStories/listActiveStories.query.js";
import { CreateStoryBodySchema, PostParamsSchema, StoryReplyBodySchema } from "../validators/posts.validator.js";

export class StoriesController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly tray = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = new ListActiveStoriesQuery(requireAuthenticatedPrincipal(ctx).userId, undefined);
    return json(200, await this.queries.execute<ListActiveStoriesQuery, readonly StoryTrayEntryDto[]>(query));
  };

  public readonly listForUser = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new ListActiveStoriesQuery(requireAuthenticatedPrincipal(ctx).userId, params.data.id);
    const [entry] = await this.queries.execute<ListActiveStoriesQuery, readonly StoryTrayEntryDto[]>(query);
    return json(200, entry?.stories ?? []);
  };

  public readonly create = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateStoryBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const input = { kind: "story" as const, media: body.data.media, ...(body.data.text === undefined ? {} : { text: body.data.text }) };
    const command = new CreatePostCommand(requireAuthenticatedPrincipal(ctx), input, findViewerLocale(ctx).currency);
    return json(201, await this.commands.execute<CreatePostCommand, PostDto>(command));
  };

  public readonly markSeen = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<MarkStorySeenCommand, void>(new MarkStorySeenCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, { seen: true });
  };

  public readonly reply = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = StoryReplyBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ReplyToStoryCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.text);
    return json(201, await this.commands.execute<ReplyToStoryCommand, { conversationId: string }>(command));
  };
}
