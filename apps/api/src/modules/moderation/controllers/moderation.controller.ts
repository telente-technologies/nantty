import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { ResolveAppealCommand } from "../commands/resolveAppeal/resolveAppeal.command.js";
import type { ResolvedAppeal } from "../commands/resolveAppeal/resolveAppeal.handler.js";
import { SubmitAppealCommand } from "../commands/submitAppeal/submitAppeal.command.js";
import { SubmitReportCommand } from "../commands/submitReport/submitReport.command.js";
import type { SubmittedReport } from "../commands/submitReport/submitReport.handler.js";
import { TakeModerationActionCommand } from "../commands/takeModerationAction/takeModerationAction.command.js";
import type { AppealDto, ContentReportDto, DecisionDto, ModerationCaseDetailDto, ModerationCaseDto } from "../dtos/moderation.dto.js";
import { GetModerationCaseQuery } from "../queries/getModerationCase/getModerationCase.query.js";
import { ListModerationAppealsQuery } from "../queries/listModerationAppeals/listModerationAppeals.query.js";
import { ListModerationCasesQuery } from "../queries/listModerationCases/listModerationCases.query.js";
import { ListMyModerationDecisionsQuery } from "../queries/listMyModerationDecisions/listMyModerationDecisions.query.js";
import { ListMyReportsQuery } from "../queries/listMyReports/listMyReports.query.js";
import {
  IdParamsSchema,
  ListAppealsQuerySchema,
  ListCasesQuerySchema,
  ResolveAppealBodySchema,
  SubmitAppealBodySchema,
  SubmitReportBodySchema,
  TakeActionBodySchema,
} from "../validators/moderation.validator.js";

export class ModerationController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly submitReport = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = SubmitReportBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SubmitReportCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<SubmitReportCommand, SubmittedReport>(command));
  };

  public readonly listMyReports = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const reports = await this.queries.execute<ListMyReportsQuery, readonly ContentReportDto[]>(new ListMyReportsQuery(requireAuthenticatedPrincipal(ctx)));
    return json(200, { data: reports, nextCursor: null });
  };

  public readonly listMyDecisions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = new ListMyModerationDecisionsQuery(requireAuthenticatedPrincipal(ctx));
    return json(200, { data: await this.queries.execute<ListMyModerationDecisionsQuery, readonly DecisionDto[]>(query), nextCursor: null });
  };

  public readonly submitAppeal = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = SubmitAppealBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SubmitAppealCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.statement);
    return json(201, await this.commands.execute<SubmitAppealCommand, AppealDto>(command));
  };

  public readonly listCases = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListCasesQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListModerationCasesQuery(query.data.status, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListModerationCasesQuery, Page<ModerationCaseDto>>(listQuery));
  };

  public readonly getCase = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute<GetModerationCaseQuery, ModerationCaseDetailDto>(new GetModerationCaseQuery(params.data.id)));
  };

  public readonly takeAction = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = TakeActionBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new TakeModerationActionCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(201, await this.commands.execute<TakeModerationActionCommand, DecisionDto>(command));
  };

  public readonly listAppeals = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListAppealsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListModerationAppealsQuery(query.data.status, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListModerationAppealsQuery, Page<AppealDto>>(listQuery));
  };

  public readonly resolveAppeal = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ResolveAppealBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ResolveAppealCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(200, await this.commands.execute<ResolveAppealCommand, ResolvedAppeal>(command));
  };
}
