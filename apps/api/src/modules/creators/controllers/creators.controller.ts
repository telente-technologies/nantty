import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { IDEMPOTENCY_KEY_HEADER } from "../../../constants/security.constant.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { ChangeCreatorAffiliationCommand } from "../commands/changeCreatorAffiliation/changeCreatorAffiliation.command.js";
import { SendLiveGiftCommand } from "../commands/sendLiveGift/sendLiveGift.command.js";
import { SubmitCreatorApplicationCommand } from "../commands/submitCreatorApplication/submitCreatorApplication.command.js";
import type { SubmitCreatorApplicationResult } from "../commands/submitCreatorApplication/submitCreatorApplication.handler.js";
import type { CreatorAffiliationDto, CreatorApplicationDto, CreatorDashboardDto, CreatorEarningDto, GiftCatalogEntryDto, LiveGiftReceiptDto } from "../dtos/creators.dto.js";
import type { CreatorEligibility } from "../models/creators.model.js";
import { GetCreatorDashboardQuery } from "../queries/getCreatorDashboard/getCreatorDashboard.query.js";
import { GetCreatorEligibilityQuery } from "../queries/getCreatorEligibility/getCreatorEligibility.query.js";
import { GetMyCreatorApplicationQuery } from "../queries/getMyCreatorApplication/getMyCreatorApplication.query.js";
import { GetMyCreatorStatusQuery } from "../queries/getMyCreatorStatus/getMyCreatorStatus.query.js";
import { ListCreatorAffiliationsQuery } from "../queries/listCreatorAffiliations/listCreatorAffiliations.query.js";
import { ListCreatorEarningsQuery } from "../queries/listCreatorEarnings/listCreatorEarnings.query.js";
import { ListGiftCatalogQuery } from "../queries/listGiftCatalog/listGiftCatalog.query.js";
import type { CreatorProgramStatusView } from "../services/creators.service.js";
import { AffiliateTargetBodySchema, DashboardQuerySchema, IdParamsSchema, PageQuerySchema, SendLiveGiftBodySchema } from "../validators/creators.validator.js";

export class CreatorsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly me = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<GetMyCreatorStatusQuery, CreatorProgramStatusView>(new GetMyCreatorStatusQuery(requireAuthenticatedPrincipal(ctx).userId)));

  public readonly eligibility = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<GetCreatorEligibilityQuery, CreatorEligibility>(new GetCreatorEligibilityQuery(requireAuthenticatedPrincipal(ctx).userId)));

  public readonly apply = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const result = await this.commands.execute<SubmitCreatorApplicationCommand, SubmitCreatorApplicationResult>(new SubmitCreatorApplicationCommand(requireAuthenticatedPrincipal(ctx)));
    if (result.outcome === "submitted") return json(201, result.application);
    return json(422, {
      message: `You do not meet every Creator Program requirement yet: ${result.unmetCriteria.join(", ")}.`,
      code: "CREATOR_NOT_ELIGIBLE",
      unmetCriteria: result.unmetCriteria,
      eligibility: result.eligibility,
    });
  };

  public readonly myApplication = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<GetMyCreatorApplicationQuery, CreatorApplicationDto>(new GetMyCreatorApplicationQuery(requireAuthenticatedPrincipal(ctx).userId)));

  public readonly dashboard = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = DashboardQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const dashboardQuery = new GetCreatorDashboardQuery(requireAuthenticatedPrincipal(ctx).userId, query.data.period);
    return json(200, await this.queries.execute<GetCreatorDashboardQuery, CreatorDashboardDto>(dashboardQuery));
  };

  public readonly earnings = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = PageQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const earningsQuery = new ListCreatorEarningsQuery(requireAuthenticatedPrincipal(ctx).userId, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListCreatorEarningsQuery, Page<CreatorEarningDto>>(earningsQuery));
  };

  public readonly affiliations = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const data = await this.queries.execute<ListCreatorAffiliationsQuery, readonly CreatorAffiliationDto[]>(new ListCreatorAffiliationsQuery(requireAuthenticatedPrincipal(ctx).userId));
    return json(200, { data });
  };

  public readonly addAffiliation = (ctx: HttpRouterContext) => this.changeAffiliation(ctx, true);

  public readonly removeAffiliation = (ctx: HttpRouterContext) => this.changeAffiliation(ctx, false);

  public readonly giftCatalog = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const data = await this.queries.execute<ListGiftCatalogQuery, readonly GiftCatalogEntryDto[]>(new ListGiftCatalogQuery(findViewerLocale(ctx).currency));
    return json(200, { data });
  };

  public readonly sendGift = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = SendLiveGiftBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SendLiveGiftCommand(requireAuthenticatedPrincipal(ctx), {
      liveSessionId: params.data.id,
      giftId: body.data.giftId,
      quantity: body.data.quantity,
      idempotencyKey: ctx.request.getHeader(IDEMPOTENCY_KEY_HEADER)?.trim() ?? "",
      currency: findViewerLocale(ctx).currency,
    });
    return json(201, await this.commands.execute<SendLiveGiftCommand, LiveGiftReceiptDto>(command));
  };

  private async changeAffiliation(ctx: HttpRouterContext, affiliated: boolean): Promise<HttpResponseContext> {
    const body = AffiliateTargetBodySchema.safeParse(affiliated ? readJsonBody(ctx) : ctx.query);
    if (!body.success) return validationFailed(body.issues);
    const command = new ChangeCreatorAffiliationCommand(requireAuthenticatedPrincipal(ctx), body.data, affiliated);
    return json(affiliated ? 201 : 200, { data: await this.commands.execute<ChangeCreatorAffiliationCommand, readonly CreatorAffiliationDto[]>(command) });
  }
}
