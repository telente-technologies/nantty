import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { ChangeChannelSubscriptionCommand } from "../commands/changeChannelSubscription/changeChannelSubscription.command.js";
import { ChangeGroupMembershipCommand } from "../commands/changeGroupMembership/changeGroupMembership.command.js";
import { ChangeMessageReactionCommand } from "../commands/changeMessageReaction/changeMessageReaction.command.js";
import { CreateChannelCommand } from "../commands/createChannel/createChannel.command.js";
import { CreateGroupConversationCommand } from "../commands/createGroupConversation/createGroupConversation.command.js";
import { IssueRealtimeTicketCommand } from "../commands/issueRealtimeTicket/issueRealtimeTicket.command.js";
import { StartStoreConversationCommand } from "../commands/startStoreConversation/startStoreConversation.command.js";
import type { ConversationDto, ConversationMemberDto, MessageReactionSummaryDto } from "../dtos/messages.dto.js";
import type { GroupMembershipChange } from "../models/membershipChange.model.js";
import { ListConversationMembersQuery } from "../queries/listConversationMembers/listConversationMembers.query.js";
import { ListStoreConversationsQuery } from "../queries/listStoreConversations/listStoreConversations.query.js";
import type { IssuedRealtimeTicket } from "../services/realtimeTickets.service.js";
import {
  AddMembersBodySchema,
  ConversationMemberParamsSchema,
  ConversationParamsSchema,
  CreateChannelBodySchema,
  CreateGroupBodySchema,
  MessageParamsSchema,
  MessageReactionParamsSchema,
  PromoteAdminBodySchema,
  ReactionBodySchema,
  StoreConversationsQuerySchema,
  StoreParamsSchema,
} from "../validators/messages.validator.js";

type MembershipResult = readonly ConversationMemberDto[] | undefined;

export class GroupChatsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly createGroup = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateGroupBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateGroupConversationCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<CreateGroupConversationCommand, ConversationDto>(command));
  };

  public readonly listMembers = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new ListConversationMembersQuery(requireAuthenticatedPrincipal(ctx), params.data.id);
    return json(200, { data: await this.queries.execute<ListConversationMembersQuery, readonly ConversationMemberDto[]>(query), nextCursor: null });
  };

  public readonly addMembers = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = AddMembersBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const members = await this.changeMembership(ctx, params.data.id, { type: "add", userIds: body.data.userIds });
    return json(200, { data: members ?? [], nextCursor: null });
  };

  public readonly removeMember = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationMemberParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.changeMembership(ctx, params.data.id, { type: "remove", userId: params.data.userId });
    return empty(204);
  };

  public readonly promoteAdmin = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = PromoteAdminBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    await this.changeMembership(ctx, params.data.id, { type: "promote", userId: body.data.userId });
    return empty(204);
  };

  public readonly demoteAdmin = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationMemberParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.changeMembership(ctx, params.data.id, { type: "demote", userId: params.data.userId });
    return empty(204);
  };

  public readonly leave = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.changeMembership(ctx, params.data.id, { type: "leave" });
    return empty(204);
  };

  public readonly createChannel = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateChannelBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateChannelCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<CreateChannelCommand, ConversationDto>(command));
  };

  public readonly subscribeToChannel = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ChangeChannelSubscriptionCommand(requireAuthenticatedPrincipal(ctx), params.data.id, true);
    return json(200, await this.commands.execute<ChangeChannelSubscriptionCommand, ConversationDto | undefined>(command));
  };

  public readonly unsubscribeFromChannel = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ConversationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute(new ChangeChannelSubscriptionCommand(requireAuthenticatedPrincipal(ctx), params.data.id, false));
    return empty(204);
  };

  public readonly addReaction = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = MessageParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ReactionBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ChangeMessageReactionCommand(requireAuthenticatedPrincipal(ctx), params.data.messageId, body.data.emoji, true);
    return json(200, await this.commands.execute<ChangeMessageReactionCommand, readonly MessageReactionSummaryDto[]>(command));
  };

  public readonly removeReaction = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = MessageReactionParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ChangeMessageReactionCommand(requireAuthenticatedPrincipal(ctx), params.data.messageId, decodeURIComponent(params.data.emoji), false);
    return json(200, await this.commands.execute<ChangeMessageReactionCommand, readonly MessageReactionSummaryDto[]>(command));
  };

  public readonly startStoreConversation = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new StartStoreConversationCommand(requireAuthenticatedPrincipal(ctx), params.data.storeId);
    return json(200, await this.commands.execute<StartStoreConversationCommand, ConversationDto>(command));
  };

  public readonly listStoreConversations = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = StoreConversationsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const inboxQuery = new ListStoreConversationsQuery(requireAuthenticatedPrincipal(ctx), query.data.storeId);
    return json(200, { data: await this.queries.execute<ListStoreConversationsQuery, readonly ConversationDto[]>(inboxQuery), nextCursor: null });
  };

  public readonly issueRealtimeTicket = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const command = new IssueRealtimeTicketCommand(requireAuthenticatedPrincipal(ctx));
    return json(201, await this.commands.execute<IssueRealtimeTicketCommand, IssuedRealtimeTicket>(command));
  };

  private changeMembership(ctx: HttpRouterContext, conversationId: string, change: GroupMembershipChange): Promise<MembershipResult> {
    const command = new ChangeGroupMembershipCommand(requireAuthenticatedPrincipal(ctx), conversationId, change);
    return this.commands.execute<ChangeGroupMembershipCommand, MembershipResult>(command);
  }
}
