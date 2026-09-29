import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { findAuthenticatedPrincipal, requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { CreateSupportTicketCommand } from "../commands/createSupportTicket/createSupportTicket.command.js";
import { PostSupportTicketMessageCommand } from "../commands/postSupportTicketMessage/postSupportTicketMessage.command.js";
import { SubmitContactRequestCommand } from "../commands/submitContactRequest/submitContactRequest.command.js";
import type { ContactRequestReceipt } from "../commands/submitContactRequest/submitContactRequest.handler.js";
import { UpdateSupportTicketCommand } from "../commands/updateSupportTicket/updateSupportTicket.command.js";
import type { SupportTicketDetailDto, SupportTicketMessageDto, SupportTicketSummaryDto } from "../dtos/support.dto.js";
import { GetSupportTicketQuery } from "../queries/getSupportTicket/getSupportTicket.query.js";
import { ListMySupportTicketsQuery } from "../queries/listMySupportTickets/listMySupportTickets.query.js";
import { ListSupportTicketsQuery } from "../queries/listSupportTickets/listSupportTickets.query.js";
import {
  ContactRequestBodySchema,
  CreateTicketBodySchema,
  ListTicketsQuerySchema,
  TicketMessageBodySchema,
  TicketParamsSchema,
  UpdateTicketBodySchema,
} from "../validators/support.validator.js";

export class SupportController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly listMyTickets = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = new ListMySupportTicketsQuery(requireAuthenticatedPrincipal(ctx));
    return json(200, { data: await this.queries.execute<ListMySupportTicketsQuery, readonly SupportTicketSummaryDto[]>(query), nextCursor: null });
  };

  public readonly createTicket = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateTicketBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateSupportTicketCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<CreateSupportTicketCommand, SupportTicketDetailDto>(command));
  };

  public readonly getMyTicket = (ctx: HttpRouterContext) => this.getTicket(ctx, false);
  public readonly getTicketAsAgent = (ctx: HttpRouterContext) => this.getTicket(ctx, true);
  public readonly replyAsCustomer = (ctx: HttpRouterContext) => this.postMessage(ctx, false);
  public readonly replyAsAgent = (ctx: HttpRouterContext) => this.postMessage(ctx, true);

  public readonly listTickets = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListTicketsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListSupportTicketsQuery(query.data.status, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListSupportTicketsQuery, Page<SupportTicketSummaryDto>>(listQuery));
  };

  public readonly updateTicket = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = TicketParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateTicketBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdateSupportTicketCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(200, await this.commands.execute<UpdateSupportTicketCommand, SupportTicketSummaryDto>(command));
  };

  public readonly submitContactRequest = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = ContactRequestBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SubmitContactRequestCommand(findAuthenticatedPrincipal(ctx), body.data);
    return json(202, await this.commands.execute<SubmitContactRequestCommand, ContactRequestReceipt>(command));
  };

  private async getTicket(ctx: HttpRouterContext, asAgent: boolean): Promise<HttpResponseContext> {
    const params = TicketParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new GetSupportTicketQuery(requireAuthenticatedPrincipal(ctx), params.data.id, asAgent);
    return json(200, await this.queries.execute<GetSupportTicketQuery, SupportTicketDetailDto>(query));
  }

  private async postMessage(ctx: HttpRouterContext, asAgent: boolean): Promise<HttpResponseContext> {
    const params = TicketParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = TicketMessageBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new PostSupportTicketMessageCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data, asAgent);
    return json(201, await this.commands.execute<PostSupportTicketMessageCommand, SupportTicketMessageDto>(command));
  }
}
