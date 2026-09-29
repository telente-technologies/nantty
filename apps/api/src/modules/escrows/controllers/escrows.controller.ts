import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { OrderParamsSchema } from "../../orders/validators/orders.validator.js";
import { OpenDisputeCommand } from "../commands/openDispute/openDispute.command.js";
import { PostDisputeMessageCommand } from "../commands/postDisputeMessage/postDisputeMessage.command.js";
import { ResolveDisputeCommand } from "../commands/resolveDispute/resolveDispute.command.js";
import { convertDisputeMessageToDto, convertDisputeToDto, convertEscrowTimelineToDto } from "../dtos/escrows.dto.js";
import type { DisputeMessageRecord, DisputeRecord } from "../models/escrows.model.js";
import { GetDisputeQuery } from "../queries/getDispute/getDispute.query.js";
import type { EscrowWithTimeline } from "../queries/getEscrow/getEscrow.handler.js";
import { GetEscrowQuery } from "../queries/getEscrow/getEscrow.query.js";
import { ListDisputeMessagesQuery } from "../queries/listDisputeMessages/listDisputeMessages.query.js";
import { ListDisputesQuery } from "../queries/listDisputes/listDisputes.query.js";
import type { DisputeForViewer } from "../services/disputeConversation.service.js";
import {
  DisputeParamsSchema,
  ListDisputesQuerySchema,
  OpenDisputeBodySchema,
  PostDisputeMessageBodySchema,
  ResolveDisputeBodySchema,
} from "../validators/escrows.validator.js";

export class EscrowsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly getForOrder = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const result = await this.queries.execute<GetEscrowQuery, EscrowWithTimeline>(new GetEscrowQuery(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, convertEscrowTimelineToDto(result.escrow, result.timeline));
  };

  public readonly openDispute = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = OpenDisputeBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new OpenDisputeCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.reason, body.data.details ?? "", body.data.evidenceMediaIds ?? []);
    return json(201, convertDisputeToDto(await this.commands.execute<OpenDisputeCommand, DisputeRecord>(command)));
  };

  public readonly getDispute = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = DisputeParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const result = await this.queries.execute<GetDisputeQuery, DisputeForViewer>(new GetDisputeQuery(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, { ...convertDisputeToDto(result.dispute), storeId: result.order.storeId, orderNumber: result.order.number, viewerRole: result.viewerRole });
  };

  public readonly listMessages = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = DisputeParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new ListDisputeMessagesQuery(requireAuthenticatedPrincipal(ctx), params.data.id);
    const messages = await this.queries.execute<ListDisputeMessagesQuery, readonly DisputeMessageRecord[]>(query);
    return json(200, { data: messages.map(convertDisputeMessageToDto) });
  };

  public readonly postMessage = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = DisputeParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = PostDisputeMessageBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new PostDisputeMessageCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.text, body.data.attachmentMediaIds ?? []);
    return json(201, convertDisputeMessageToDto(await this.commands.execute<PostDisputeMessageCommand, DisputeMessageRecord>(command)));
  };

  public readonly listDisputes = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListDisputesQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { status, ...page } = query.data;
    const result = await this.queries.execute<ListDisputesQuery, Page<DisputeRecord>>(new ListDisputesQuery(status, buildPageRequest(page)));
    return json(200, mapPageItems(result, convertDisputeToDto));
  };

  public readonly resolveDispute = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = DisputeParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ResolveDisputeBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ResolveDisputeCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.outcome, body.data.note);
    return json(200, convertDisputeToDto(await this.commands.execute<ResolveDisputeCommand, DisputeRecord>(command)));
  };
}
