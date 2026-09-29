import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { ReviewSellerApplicationCommand } from "../commands/reviewSellerApplication/reviewSellerApplication.command.js";
import { SubmitSellerApplicationCommand } from "../commands/submitSellerApplication/submitSellerApplication.command.js";
import type { SellerApplicationDto } from "../dtos/stores.dto.js";
import { ListMySellerApplicationsQuery } from "../queries/listMySellerApplications/listMySellerApplications.query.js";
import { ListSellerApplicationsQuery } from "../queries/listSellerApplications/listSellerApplications.query.js";
import {
  ApplicationParamsSchema,
  ListSellerApplicationsQuerySchema,
  ReviewSellerApplicationBodySchema,
  SubmitSellerApplicationBodySchema,
} from "../validators/stores.validator.js";

export class SellerApplicationsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly submit = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = SubmitSellerApplicationBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SubmitSellerApplicationCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<SubmitSellerApplicationCommand, SellerApplicationDto>(command));
  };

  public readonly listMine = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = new ListMySellerApplicationsQuery(requireAuthenticatedPrincipal(ctx));
    return json(200, { items: await this.queries.execute<ListMySellerApplicationsQuery, readonly SellerApplicationDto[]>(query) });
  };

  public readonly listForReview = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListSellerApplicationsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListSellerApplicationsQuery(query.data.status, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListSellerApplicationsQuery, Page<SellerApplicationDto>>(listQuery));
  };

  public readonly review = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ApplicationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ReviewSellerApplicationBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ReviewSellerApplicationCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(200, await this.commands.execute<ReviewSellerApplicationCommand, SellerApplicationDto>(command));
  };
}
