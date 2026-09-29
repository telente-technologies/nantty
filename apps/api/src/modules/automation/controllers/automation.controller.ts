import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { CreateAutomationRuleCommand } from "../commands/createAutomationRule/createAutomationRule.command.js";
import { DeleteAutomationRuleCommand } from "../commands/deleteAutomationRule/deleteAutomationRule.command.js";
import { UpdateAutomationRuleCommand } from "../commands/updateAutomationRule/updateAutomationRule.command.js";
import type { AutomationExecutionDto, AutomationRuleDto } from "../dtos/automation.dto.js";
import { AUTOMATION_ACTION_TYPES, AUTOMATION_TRIGGERS, CONDITION_OPERATORS } from "../models/automation.model.js";
import { GetAutomationRuleQuery } from "../queries/getAutomationRule/getAutomationRule.query.js";
import { ListAutomationExecutionsQuery } from "../queries/listAutomationExecutions/listAutomationExecutions.query.js";
import { ListAutomationRulesQuery } from "../queries/listAutomationRules/listAutomationRules.query.js";
import { CreateRuleBodySchema, ListExecutionsQuerySchema, RuleParamsSchema, UpdateRuleBodySchema } from "../validators/automation.validator.js";

const AUTOMATION_CATALOG = { triggers: AUTOMATION_TRIGGERS, operators: CONDITION_OPERATORS, actions: AUTOMATION_ACTION_TYPES };

export class AutomationController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly describeCatalog = async (): Promise<HttpResponseContext> => json(200, AUTOMATION_CATALOG);

  public readonly listRules = async (): Promise<HttpResponseContext> => {
    const rules = await this.queries.execute<ListAutomationRulesQuery, readonly AutomationRuleDto[]>(new ListAutomationRulesQuery());
    return json(200, { data: rules, nextCursor: null });
  };

  public readonly createRule = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateRuleBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateAutomationRuleCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<CreateAutomationRuleCommand, AutomationRuleDto>(command));
  };

  public readonly getRule = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = RuleParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute<GetAutomationRuleQuery, AutomationRuleDto>(new GetAutomationRuleQuery(params.data.id)));
  };

  public readonly updateRule = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = RuleParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateRuleBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdateAutomationRuleCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(200, await this.commands.execute<UpdateAutomationRuleCommand, AutomationRuleDto>(command));
  };

  public readonly deleteRule = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = RuleParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<DeleteAutomationRuleCommand, void>(new DeleteAutomationRuleCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  public readonly listExecutions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = RuleParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = ListExecutionsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListAutomationExecutionsQuery(params.data.id, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListAutomationExecutionsQuery, Page<AutomationExecutionDto>>(listQuery));
  };
}
