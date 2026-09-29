import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { OrderParamsSchema } from "../../orders/validators/orders.validator.js";
import { OpenDisputeCommand } from "../commands/openDispute/openDispute.command.js";
import { ResolveDisputeCommand } from "../commands/resolveDispute/resolveDispute.command.js";
import { convertDisputeToDto, convertEscrowToDto } from "../dtos/escrows.dto.js";
import type { DisputeRecord, EscrowRecord } from "../models/escrows.model.js";
import { GetEscrowQuery } from "../queries/getEscrow/getEscrow.query.js";
import { ListDisputesQuery } from "../queries/listDisputes/listDisputes.query.js";
import { DisputeParamsSchema, ListDisputesQuerySchema, OpenDisputeBodySchema, ResolveDisputeBodySchema } from "../validators/escrows.validator.js";

export class EscrowsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly getForOrder = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const escrow = await this.queries.execute<GetEscrowQuery, EscrowRecord>(new GetEscrowQuery(requireAuthenticatedPrincipal(ctx), params.data.id));
    return json(200, convertEscrowToDto(escrow));
  };

  public readonly openDispute = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = OrderParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = OpenDisputeBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new OpenDisputeCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.reason, body.data.details ?? "");
    return json(201, convertDisputeToDto(await this.commands.execute<OpenDisputeCommand, DisputeRecord>(command)));
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
