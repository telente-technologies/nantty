import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { findAuthenticatedPrincipal, requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { AddLiveProductCommand } from "../commands/addLiveProduct/addLiveProduct.command.js";
import { CommentOnLiveSessionCommand } from "../commands/commentOnLiveSession/commentOnLiveSession.command.js";
import { EndLiveSessionCommand } from "../commands/endLiveSession/endLiveSession.command.js";
import { JoinLiveSessionCommand } from "../commands/joinLiveSession/joinLiveSession.command.js";
import { LeaveLiveSessionCommand } from "../commands/leaveLiveSession/leaveLiveSession.command.js";
import { ReactToLiveSessionCommand } from "../commands/reactToLiveSession/reactToLiveSession.command.js";
import { ShareLiveSessionCommand } from "../commands/shareLiveSession/shareLiveSession.command.js";
import { StartLiveSessionCommand } from "../commands/startLiveSession/startLiveSession.command.js";
import type { LiveCommentDto, LiveSessionDto } from "../dtos/posts.dto.js";
import { GetLiveSessionQuery } from "../queries/getLiveSession/getLiveSession.query.js";
import { ListLiveCommentsQuery } from "../queries/listLiveComments/listLiveComments.query.js";
import { ListLiveSessionsQuery } from "../queries/listLiveSessions/listLiveSessions.query.js";
import {
  LiveCommentBodySchema,
  LiveProductBodySchema,
  LiveReactionBodySchema,
  LiveShareBodySchema,
  PageQuerySchemaForLists,
  PostParamsSchema,
  StartLiveBodySchema,
} from "../validators/posts.validator.js";

type SessionCommandFactory = (principal: Principal, sessionId: string, displayCurrency: CurrencyCode) => JoinLiveSessionCommand | LeaveLiveSessionCommand | EndLiveSessionCommand;

const SUGGESTED_LIVE_CANDIDATES = 50;
const SUGGESTED_LIVE_COUNT = 10;

export class LiveController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly start = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = StartLiveBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new StartLiveSessionCommand(requireAuthenticatedPrincipal(ctx), body.data, findViewerLocale(ctx).currency);
    return json(201, await this.commands.execute<StartLiveSessionCommand, LiveSessionDto>(command));
  };

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = PageQuerySchemaForLists.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    return json(200, await this.queries.execute<ListLiveSessionsQuery, Page<LiveSessionDto>>(new ListLiveSessionsQuery(buildPageRequest(query.data), findViewerLocale(ctx).currency)));
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute<GetLiveSessionQuery, LiveSessionDto>(new GetLiveSessionQuery(params.data.id, findViewerLocale(ctx).currency)));
  };

  public readonly join = (ctx: HttpRouterContext) => this.runSessionCommand(ctx, (principal, id, currency) => new JoinLiveSessionCommand(principal, id, currency));
  public readonly leave = (ctx: HttpRouterContext) => this.runSessionCommand(ctx, (principal, id, currency) => new LeaveLiveSessionCommand(principal, id, currency));
  public readonly end = (ctx: HttpRouterContext) => this.runSessionCommand(ctx, (principal, id, currency) => new EndLiveSessionCommand(principal, id, currency));

  public readonly listSuggested = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const viewerId = findAuthenticatedPrincipal(ctx)?.userId;
    const page = await this.queries.execute<ListLiveSessionsQuery, Page<LiveSessionDto>>(
      new ListLiveSessionsQuery({ limit: SUGGESTED_LIVE_CANDIDATES }, findViewerLocale(ctx).currency),
    );
    const suggestions = page.data.filter((session) => session.host?.id !== viewerId).sort((left, right) => right.viewerCount - left.viewerCount);
    return json(200, suggestions.slice(0, SUGGESTED_LIVE_COUNT));
  };

  public readonly react = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = LiveReactionBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ReactToLiveSessionCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.emoji);
    return json(200, await this.commands.execute<ReactToLiveSessionCommand, { emoji: string; reactionCount: number }>(command));
  };

  public readonly share = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = LiveShareBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ShareLiveSessionCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.userIds);
    return json(200, await this.commands.execute<ShareLiveSessionCommand, { sharedWith: number }>(command));
  };

  public readonly listComments = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = PageQuerySchemaForLists.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListLiveCommentsQuery(params.data.id, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListLiveCommentsQuery, Page<LiveCommentDto>>(listQuery));
  };

  public readonly addComment = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = LiveCommentBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CommentOnLiveSessionCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.text);
    return json(201, await this.commands.execute<CommentOnLiveSessionCommand, LiveCommentDto>(command));
  };

  public readonly addProduct = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = LiveProductBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new AddLiveProductCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.productId, body.data.pin, findViewerLocale(ctx).currency);
    return json(200, await this.commands.execute<AddLiveProductCommand, LiveSessionDto>(command));
  };

  private async runSessionCommand(ctx: HttpRouterContext, createCommand: SessionCommandFactory): Promise<HttpResponseContext> {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = createCommand(requireAuthenticatedPrincipal(ctx), params.data.id, findViewerLocale(ctx).currency);
    return json(200, await this.commands.execute<typeof command, LiveSessionDto>(command));
  }
}
