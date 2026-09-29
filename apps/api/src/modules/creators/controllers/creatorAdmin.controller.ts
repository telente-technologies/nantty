import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { ChangeCreatorStandingCommand } from "../commands/changeCreatorStanding/changeCreatorStanding.command.js";
import { RemoveAffiliateCommissionCommand } from "../commands/removeAffiliateCommission/removeAffiliateCommission.command.js";
import { ReviewCreatorApplicationCommand } from "../commands/reviewCreatorApplication/reviewCreatorApplication.command.js";
import { SetAffiliateCommissionCommand } from "../commands/setAffiliateCommission/setAffiliateCommission.command.js";
import type { AffiliateCommissionDto, CreatorApplicationDto } from "../dtos/creators.dto.js";
import { ListAffiliateCommissionsQuery } from "../queries/listAffiliateCommissions/listAffiliateCommissions.query.js";
import { ListCreatorApplicationsQuery } from "../queries/listCreatorApplications/listCreatorApplications.query.js";
import type { CreatorProgramStatusView } from "../services/creators.service.js";
import {
  AffiliateCommissionBodySchema,
  AffiliateCommissionQuerySchema,
  CreatorStandingBodySchema,
  IdParamsSchema,
  ListCreatorApplicationsQuerySchema,
  ReviewCreatorApplicationBodySchema,
  UserIdParamsSchema,
} from "../validators/creators.validator.js";

export class CreatorAdminController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly listApplications = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListCreatorApplicationsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { status, ...page } = query.data;
    return json(200, await this.queries.execute<ListCreatorApplicationsQuery, Page<CreatorApplicationDto>>(new ListCreatorApplicationsQuery(status, buildPageRequest(page))));
  };

  public readonly reviewApplication = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ReviewCreatorApplicationBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ReviewCreatorApplicationCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(200, await this.commands.execute<ReviewCreatorApplicationCommand, CreatorApplicationDto>(command));
  };

  public readonly suspend = (ctx: HttpRouterContext) => this.changeStanding(ctx, "suspend");

  public readonly reinstate = (ctx: HttpRouterContext) => this.changeStanding(ctx, "reinstate");

  public readonly listCommissions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = AffiliateCommissionQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const data = await this.queries.execute<ListAffiliateCommissionsQuery, readonly AffiliateCommissionDto[]>(new ListAffiliateCommissionsQuery(requireAuthenticatedPrincipal(ctx), query.data));
    return json(200, { data });
  };

  public readonly setCommission = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AffiliateCommissionBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const { commissionBps, ...target } = body.data;
    const command = new SetAffiliateCommissionCommand(requireAuthenticatedPrincipal(ctx), target, commissionBps);
    return json(200, await this.commands.execute<SetAffiliateCommissionCommand, AffiliateCommissionDto>(command));
  };

  public readonly removeCommission = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = AffiliateCommissionQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    await this.commands.execute<RemoveAffiliateCommissionCommand, void>(new RemoveAffiliateCommissionCommand(requireAuthenticatedPrincipal(ctx), query.data));
    return empty(204);
  };

  private async changeStanding(ctx: HttpRouterContext, action: "suspend" | "reinstate"): Promise<HttpResponseContext> {
    const params = UserIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = CreatorStandingBodySchema.safeParse(readJsonBody(ctx) ?? {});
    if (!body.success) return validationFailed(body.issues);
    const command = new ChangeCreatorStandingCommand(requireAuthenticatedPrincipal(ctx), params.data.userId, action, body.data.reason ?? null);
    return json(200, await this.commands.execute<ChangeCreatorStandingCommand, CreatorProgramStatusView>(command));
  }
}
