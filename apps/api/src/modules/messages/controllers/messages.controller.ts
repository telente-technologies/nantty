import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { MarkConversationReadCommand } from "../commands/markConversationRead/markConversationRead.command.js";
import { SendMessageCommand } from "../commands/sendMessage/sendMessage.command.js";
import { StartConversationCommand } from "../commands/startConversation/startConversation.command.js";
import { convertMessageToDto, type ConversationSummaryDto, type MessageSearchResultDto } from "../dtos/messages.dto.js";
import type { MessageRecord } from "../models/messages.model.js";
import { GetConversationQuery } from "../queries/getConversation/getConversation.query.js";
import { GetUnreadMessageCountQuery } from "../queries/getUnreadMessageCount/getUnreadMessageCount.query.js";
import type { UnreadMessageCounts } from "../queries/getUnreadMessageCount/getUnreadMessageCount.handler.js";
import { ListConversationsQuery } from "../queries/listConversations/listConversations.query.js";
import { ListMessagesQuery } from "../queries/listMessages/listMessages.query.js";
import { SearchMessagesQuery } from "../queries/searchMessages/searchMessages.query.js";
import {
  ConversationParamsSchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  SearchMessagesQuerySchema,
  SendMessageBodySchema,
  StartConversationBodySchema,
} from "../validators/messages.validator.js";

export class MessagesController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly startConversation = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = StartConversationBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new StartConversationCommand(requireAuthenticatedPrincipal(ctx), body.data.userId);
    return json(200, await this.commands.execute<StartConversationCommand, ConversationSummaryDto>(command));
  };

  public readonly listConversations = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListConversationsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListConversationsQuery(requireAuthenticatedPrincipal(ctx), query.data.filter ?? "all", query.data.q);
    const conversations = await this.queries.execute<ListConversationsQuery, readonly ConversationSummaryDto[]>(listQuery);
    return json(200, { data: conversations, nextCursor: null });
  };

  public readonly getConversation = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new GetConversationQuery(requireAuthenticatedPrincipal(ctx), params.data.id);
    return json(200, await this.queries.execute<GetConversationQuery, ConversationSummaryDto>(query));
  };

  public readonly listMessages = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = ListMessagesQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListMessagesQuery(requireAuthenticatedPrincipal(ctx), params.data.id, buildPageRequest(query.data));
    const page = await this.queries.execute<ListMessagesQuery, Page<MessageRecord>>(listQuery);
    return json(200, mapPageItems(page, convertMessageToDto));
  };

  public readonly sendMessage = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = SendMessageBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SendMessageCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(201, convertMessageToDto(await this.commands.execute<SendMessageCommand, MessageRecord>(command)));
  };

  public readonly markRead = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<MarkConversationReadCommand, void>(new MarkConversationReadCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  public readonly unreadCount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = new GetUnreadMessageCountQuery(requireAuthenticatedPrincipal(ctx));
    return json(200, await this.queries.execute<GetUnreadMessageCountQuery, UnreadMessageCounts>(query));
  };

  public readonly search = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = SearchMessagesQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const searchQuery = new SearchMessagesQuery(requireAuthenticatedPrincipal(ctx), query.data.q);
    return json(200, await this.queries.execute<SearchMessagesQuery, MessageSearchResultDto>(searchQuery));
  };
}
