import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { ReplaceSubscriptionPlanEntitlementsCommand } from "../commands/replaceSubscriptionPlanEntitlements/replaceSubscriptionPlanEntitlements.command.js";
import { ReplaceSubscriptionPlanPerksCommand } from "../commands/replaceSubscriptionPlanPerks/replaceSubscriptionPlanPerks.command.js";
import { ReplaceSubscriptionPlanPricesCommand } from "../commands/replaceSubscriptionPlanPrices/replaceSubscriptionPlanPrices.command.js";
import { UpdateSubscriptionPlanCommand } from "../commands/updateSubscriptionPlan/updateSubscriptionPlan.command.js";
import { convertPlanToAdminDto } from "../dtos/subscriptions.dto.js";
import type { PlanRecord } from "../models/subscriptions.model.js";
import { ListAllSubscriptionPlansQuery } from "../queries/listAllSubscriptionPlans/listAllSubscriptionPlans.query.js";
import {
  PlanParamsSchema,
  ReplaceEntitlementsBodySchema,
  ReplacePerksBodySchema,
  ReplacePricesBodySchema,
  UpdatePlanBodySchema,
} from "../validators/subscriptions.validator.js";

export class SubscriptionPlansAdminController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly list = async (): Promise<HttpResponseContext> => {
    const plans = await this.queries.execute<ListAllSubscriptionPlansQuery, readonly PlanRecord[]>(new ListAllSubscriptionPlansQuery());
    return json(200, { data: plans.map(convertPlanToAdminDto) });
  };

  public readonly update = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PlanParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdatePlanBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const changes = Object.fromEntries(Object.entries(body.data).filter(([, value]) => value !== undefined));
    const command = new UpdateSubscriptionPlanCommand(requireAuthenticatedPrincipal(ctx), params.data.id, changes);
    return json(200, convertPlanToAdminDto(await this.commands.execute<UpdateSubscriptionPlanCommand, PlanRecord>(command)));
  };

  public readonly replacePrices = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PlanParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ReplacePricesBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ReplaceSubscriptionPlanPricesCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.prices);
    return json(200, convertPlanToAdminDto(await this.commands.execute<ReplaceSubscriptionPlanPricesCommand, PlanRecord>(command)));
  };

  public readonly replaceEntitlements = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PlanParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ReplaceEntitlementsBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ReplaceSubscriptionPlanEntitlementsCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.entitlements);
    return json(200, convertPlanToAdminDto(await this.commands.execute<ReplaceSubscriptionPlanEntitlementsCommand, PlanRecord>(command)));
  };

  public readonly replacePerks = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PlanParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ReplacePerksBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const perks = body.data.perks.map((perk) => ({ title: perk.title, description: perk.description ?? "" }));
    const command = new ReplaceSubscriptionPlanPerksCommand(requireAuthenticatedPrincipal(ctx), params.data.id, perks);
    return json(200, convertPlanToAdminDto(await this.commands.execute<ReplaceSubscriptionPlanPerksCommand, PlanRecord>(command)));
  };
}
