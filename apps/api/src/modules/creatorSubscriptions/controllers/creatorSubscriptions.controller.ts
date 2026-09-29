import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { CancelCreatorSubscriptionCommand } from "../commands/cancelCreatorSubscription/cancelCreatorSubscription.command.js";
import { CreateCreatorPlanCommand } from "../commands/createCreatorPlan/createCreatorPlan.command.js";
import { ResumeCreatorSubscriptionCommand } from "../commands/resumeCreatorSubscription/resumeCreatorSubscription.command.js";
import { StartCreatorSubscriptionCommand } from "../commands/startCreatorSubscription/startCreatorSubscription.command.js";
import { UpdateCreatorPlanCommand } from "../commands/updateCreatorPlan/updateCreatorPlan.command.js";
import { VerifyCreatorSubscriptionPaymentCommand } from "../commands/verifyCreatorSubscriptionPayment/verifyCreatorSubscriptionPayment.command.js";
import { presentCreatorSubscription, type CreatorPlanDto, type CreatorSubscriberDto } from "../dtos/creatorSubscriptions.dto.js";
import type { CreatorSubscriptionRecord } from "../models/creatorSubscriptions.model.js";
import { GetCreatorSubscriptionQuery } from "../queries/getCreatorSubscription/getCreatorSubscription.query.js";
import { ListCreatorPlansQuery } from "../queries/listCreatorPlans/listCreatorPlans.query.js";
import { ListCreatorSubscribersQuery } from "../queries/listCreatorSubscribers/listCreatorSubscribers.query.js";
import { ListMyCreatorSubscriptionsQuery } from "../queries/listMyCreatorSubscriptions/listMyCreatorSubscriptions.query.js";
import type { CreatorSubscriptionCheckout } from "../services/creatorSubscriptionBilling.service.js";
import {
  CreatePlanBodySchema,
  CreatorIdParamsSchema,
  PlanIdParamsSchema,
  StartSubscriptionBodySchema,
  SubscriptionIdParamsSchema,
  UpdatePlanBodySchema,
  VerifySubscriptionBodySchema,
} from "../validators/creatorSubscriptions.validator.js";

export class CreatorSubscriptionsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly createPlan = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreatePlanBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const { price, ...rest } = body.data;
    const command = new CreateCreatorPlanCommand(requireAuthenticatedPrincipal(ctx).userId, { ...rest, amountMinor: price.amountMinor, currency: price.currency });
    return json(201, await this.commands.execute<CreateCreatorPlanCommand, CreatorPlanDto>(command));
  };

  public readonly updatePlan = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PlanIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdatePlanBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdateCreatorPlanCommand(requireAuthenticatedPrincipal(ctx).userId, params.data.planId, body.data);
    return json(200, await this.commands.execute<UpdateCreatorPlanCommand, CreatorPlanDto>(command));
  };

  public readonly myPlans = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = new ListCreatorPlansQuery(requireAuthenticatedPrincipal(ctx).userId, true);
    return json(200, { data: await this.queries.execute<ListCreatorPlansQuery, readonly CreatorPlanDto[]>(query) });
  };

  public readonly creatorPlans = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CreatorIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, { data: await this.queries.execute<ListCreatorPlansQuery, readonly CreatorPlanDto[]>(new ListCreatorPlansQuery(params.data.creatorId, false)) });
  };

  public readonly mySubscribers = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = new ListCreatorSubscribersQuery(requireAuthenticatedPrincipal(ctx).userId);
    return json(200, { data: await this.queries.execute<ListCreatorSubscribersQuery, readonly CreatorSubscriberDto[]>(query) });
  };

  public readonly subscribe = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CreatorIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = StartSubscriptionBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new StartCreatorSubscriptionCommand({
      subscriberId: requireAuthenticatedPrincipal(ctx).userId, creatorId: params.data.creatorId, planId: body.data.planId, provider: body.data.provider ?? "paystack", returnTo: body.data.returnTo,
    });
    const checkout = await this.commands.execute<StartCreatorSubscriptionCommand, CreatorSubscriptionCheckout>(command);
    return json(201, {
      subscriptionId: checkout.subscription.id,
      checkoutUrl: checkout.authorizationUrl,
      authorizationUrl: checkout.authorizationUrl,
      reference: checkout.reference,
      callbackUrl: checkout.callbackUrl,
      subscription: presentCreatorSubscription(checkout.subscription),
    });
  };

  public readonly verify = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = VerifySubscriptionBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new VerifyCreatorSubscriptionPaymentCommand(requireAuthenticatedPrincipal(ctx).userId, body.data.reference);
    return json(200, presentCreatorSubscription(await this.commands.execute<VerifyCreatorSubscriptionPaymentCommand, CreatorSubscriptionRecord>(command)));
  };

  public readonly mine = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const subscriptions = await this.queries.execute<ListMyCreatorSubscriptionsQuery, readonly CreatorSubscriptionRecord[]>(new ListMyCreatorSubscriptionsQuery(requireAuthenticatedPrincipal(ctx).userId));
    return json(200, { data: subscriptions.map(presentCreatorSubscription) });
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = SubscriptionIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new GetCreatorSubscriptionQuery(requireAuthenticatedPrincipal(ctx).userId, params.data.id);
    return json(200, presentCreatorSubscription(await this.queries.execute<GetCreatorSubscriptionQuery, CreatorSubscriptionRecord>(query)));
  };

  public readonly cancel = (ctx: HttpRouterContext) => this.changeSubscription(ctx, "cancel");

  public readonly resume = (ctx: HttpRouterContext) => this.changeSubscription(ctx, "resume");

  private async changeSubscription(ctx: HttpRouterContext, change: "cancel" | "resume"): Promise<HttpResponseContext> {
    const params = SubscriptionIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const userId = requireAuthenticatedPrincipal(ctx).userId;
    const record = change === "cancel"
      ? await this.commands.execute<CancelCreatorSubscriptionCommand, CreatorSubscriptionRecord>(new CancelCreatorSubscriptionCommand(userId, params.data.id))
      : await this.commands.execute<ResumeCreatorSubscriptionCommand, CreatorSubscriptionRecord>(new ResumeCreatorSubscriptionCommand(userId, params.data.id));
    return json(200, presentCreatorSubscription(record));
  }
}
