import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { ApplyAdminSubscriptionActionCommand } from "../commands/applyAdminSubscriptionAction/applyAdminSubscriptionAction.command.js";
import { ChangeOwnSubscriptionCommand } from "../commands/changeOwnSubscription/changeOwnSubscription.command.js";
import { CheckoutSubscriptionCommand } from "../commands/checkoutSubscription/checkoutSubscription.command.js";
import { VerifySubscriptionPaymentCommand } from "../commands/verifySubscriptionPayment/verifySubscriptionPayment.command.js";
import { convertCheckoutToResponse, convertPlanToDto, convertSubscriptionToDto } from "../dtos/subscriptions.dto.js";
import type { PlanRecord, SubscriptionRecord } from "../models/subscriptions.model.js";
import { GetMySubscriptionQuery } from "../queries/getMySubscription/getMySubscription.query.js";
import { GetSubscriptionQuery } from "../queries/getSubscription/getSubscription.query.js";
import { ListSubscriptionPlansQuery } from "../queries/listSubscriptionPlans/listSubscriptionPlans.query.js";
import { ListSubscriptionsQuery } from "../queries/listSubscriptions/listSubscriptions.query.js";
import type { SubscriptionCheckout } from "../services/subscriptionBilling.service.js";
import type { AdminSubscriptionAction } from "../services/subscriptionLifecycle.service.js";
import {
  ChangePlanBodySchema,
  ListSubscriptionsQuerySchema,
  PersonalCheckoutBodySchema,
  ProfileParamsSchema,
  VerifySubscriptionBodySchema,
} from "../validators/subscriptions.validator.js";

export class SubscriptionsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly listPlans = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const plans = await this.queries.execute<ListSubscriptionPlansQuery, readonly PlanRecord[]>(new ListSubscriptionPlansQuery("BLUE"));
    const currency = findViewerLocale(ctx).currency;
    return json(200, { currency, data: plans.map((plan) => convertPlanToDto(plan, currency)) });
  };

  public readonly checkout = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = PersonalCheckoutBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CheckoutSubscriptionCommand(requireAuthenticatedPrincipal(ctx), {
      profileType: "PERSONAL",
      plan: body.data.plan,
      interval: body.data.interval ?? "MONTHLY",
      provider: body.data.provider ?? "paystack",
      trial: body.data.trial ?? false,
      returnTo: body.data.returnTo,
      preferredCurrency: findViewerLocale(ctx).currency,
    });
    return json(201, convertCheckoutToResponse(await this.commands.execute<CheckoutSubscriptionCommand, SubscriptionCheckout>(command)));
  };

  public readonly verify = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = VerifySubscriptionBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new VerifySubscriptionPaymentCommand(requireAuthenticatedPrincipal(ctx), body.data.reference);
    return json(200, convertSubscriptionToDto(await this.commands.execute<VerifySubscriptionPaymentCommand, SubscriptionRecord>(command)));
  };

  public readonly getMine = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = new GetMySubscriptionQuery(requireAuthenticatedPrincipal(ctx), "PERSONAL", undefined);
    return json(200, convertSubscriptionToDto(await this.queries.execute<GetMySubscriptionQuery, SubscriptionRecord>(query)));
  };

  public readonly getPublic = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = ProfileParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const subscription = await this.queries.execute<GetSubscriptionQuery, SubscriptionRecord>(new GetSubscriptionQuery(params.data.profileId));
    return json(200, { profileId: subscription.profileId, profileType: subscription.profileType, plan: subscription.plan, status: subscription.status });
  };

  public readonly cancel = (ctx: HttpRouterContext) => this.changeOwn(ctx, "cancel");
  public readonly resume = (ctx: HttpRouterContext) => this.changeOwn(ctx, "resume");

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListSubscriptionsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { status, plan, ...page } = query.data;
    const result = await this.queries.execute<ListSubscriptionsQuery, Page<SubscriptionRecord>>(new ListSubscriptionsQuery({ status, plan }, buildPageRequest(page)));
    return json(200, mapPageItems(result, convertSubscriptionToDto));
  };

  public readonly upgrade = (ctx: HttpRouterContext) => this.applyAdminAction(ctx, "upgrade");
  public readonly downgrade = (ctx: HttpRouterContext) => this.applyAdminAction(ctx, "downgrade");
  public readonly expire = (ctx: HttpRouterContext) => this.applyAdminAction(ctx, "expire");
  public readonly suspend = (ctx: HttpRouterContext) => this.applyAdminAction(ctx, "suspend");
  public readonly adminResume = (ctx: HttpRouterContext) => this.applyAdminAction(ctx, "resume");
  public readonly markPastDue = (ctx: HttpRouterContext) => this.applyAdminAction(ctx, "past-due");

  private async changeOwn(ctx: HttpRouterContext, change: "cancel" | "resume"): Promise<HttpResponseContext> {
    const params = ProfileParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ChangeOwnSubscriptionCommand(requireAuthenticatedPrincipal(ctx), params.data.profileId, change);
    return json(200, convertSubscriptionToDto(await this.commands.execute<ChangeOwnSubscriptionCommand, SubscriptionRecord>(command)));
  }

  private async applyAdminAction(ctx: HttpRouterContext, action: AdminSubscriptionAction): Promise<HttpResponseContext> {
    const params = ProfileParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    let plan: SubscriptionRecord["plan"] | undefined;
    if (action === "upgrade" || action === "downgrade") {
      const body = ChangePlanBodySchema.safeParse(readJsonBody(ctx));
      if (!body.success) return validationFailed(body.issues);
      plan = body.data.plan;
    }
    const command = new ApplyAdminSubscriptionActionCommand(requireAuthenticatedPrincipal(ctx), params.data.profileId, action, plan);
    return json(200, convertSubscriptionToDto(await this.commands.execute<ApplyAdminSubscriptionActionCommand, SubscriptionRecord>(command)));
  }
}
