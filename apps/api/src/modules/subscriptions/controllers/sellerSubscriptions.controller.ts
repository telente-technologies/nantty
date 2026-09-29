import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { ChangeOwnSubscriptionCommand } from "../commands/changeOwnSubscription/changeOwnSubscription.command.js";
import { CheckoutSubscriptionCommand } from "../commands/checkoutSubscription/checkoutSubscription.command.js";
import { VerifySubscriptionPaymentCommand } from "../commands/verifySubscriptionPayment/verifySubscriptionPayment.command.js";
import { convertCheckoutToResponse, convertPlanToDto, convertSubscriptionToDto } from "../dtos/subscriptions.dto.js";
import type { PlanRecord, SubscriptionRecord } from "../models/subscriptions.model.js";
import { FindPreferredPlanCurrencyQuery } from "../queries/findPreferredPlanCurrency/findPreferredPlanCurrency.query.js";
import { GetMySubscriptionQuery } from "../queries/getMySubscription/getMySubscription.query.js";
import { GetSellerAccessQuery } from "../queries/getSellerAccess/getSellerAccess.query.js";
import { ListSubscriptionPlansQuery } from "../queries/listSubscriptionPlans/listSubscriptionPlans.query.js";
import type { SellerAccessSummary } from "../services/sellerAccess.service.js";
import type { SubscriptionCheckout } from "../services/subscriptionBilling.service.js";
import { SellerCheckoutBodySchema, StoreScopeQuerySchema, VerifySubscriptionBodySchema } from "../validators/subscriptions.validator.js";

export class SellerSubscriptionsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly access = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = StoreScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    return json(200, await this.queries.execute<GetSellerAccessQuery, SellerAccessSummary>(new GetSellerAccessQuery(requireAuthenticatedPrincipal(ctx), scope.data.storeId)));
  };

  public readonly listPlans = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = StoreScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const access = await this.queries.execute<GetSellerAccessQuery, SellerAccessSummary>(new GetSellerAccessQuery(requireAuthenticatedPrincipal(ctx), scope.data.storeId));
    const currency = await this.queries.execute<FindPreferredPlanCurrencyQuery, CurrencyCode>(new FindPreferredPlanCurrencyQuery(access.storeId, findViewerLocale(ctx).currency));
    const plans = await this.queries.execute<ListSubscriptionPlansQuery, readonly PlanRecord[]>(new ListSubscriptionPlansQuery("GOLD"));
    return json(200, { storeId: access.storeId, currency, data: plans.map((plan) => convertPlanToDto(plan, currency)) });
  };

  public readonly getSubscription = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = StoreScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const query = new GetMySubscriptionQuery(requireAuthenticatedPrincipal(ctx), "STORE", scope.data.storeId);
    return json(200, convertSubscriptionToDto(await this.queries.execute<GetMySubscriptionQuery, SubscriptionRecord>(query)));
  };

  public readonly checkout = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = StoreScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const body = SellerCheckoutBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const principal = requireAuthenticatedPrincipal(ctx);
    const access = await this.queries.execute<GetSellerAccessQuery, SellerAccessSummary>(new GetSellerAccessQuery(principal, scope.data.storeId));
    const command = new CheckoutSubscriptionCommand(principal, {
      profileType: "STORE",
      storeId: access.storeId,
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

  public readonly cancel = (ctx: HttpRouterContext) => this.changeOwn(ctx, "cancel");
  public readonly resume = (ctx: HttpRouterContext) => this.changeOwn(ctx, "resume");

  private async changeOwn(ctx: HttpRouterContext, change: "cancel" | "resume"): Promise<HttpResponseContext> {
    const scope = StoreScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const principal = requireAuthenticatedPrincipal(ctx);
    const access = await this.queries.execute<GetSellerAccessQuery, SellerAccessSummary>(new GetSellerAccessQuery(principal, scope.data.storeId));
    const command = new ChangeOwnSubscriptionCommand(principal, access.storeId, change);
    return json(200, convertSubscriptionToDto(await this.commands.execute<ChangeOwnSubscriptionCommand, SubscriptionRecord>(command)));
  }
}
