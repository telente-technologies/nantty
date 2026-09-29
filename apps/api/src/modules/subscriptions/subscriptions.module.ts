import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { ApplyAdminSubscriptionActionHandler } from "./commands/applyAdminSubscriptionAction/applyAdminSubscriptionAction.handler.js";
import { ChangeOwnSubscriptionHandler } from "./commands/changeOwnSubscription/changeOwnSubscription.handler.js";
import { CheckoutSubscriptionHandler } from "./commands/checkoutSubscription/checkoutSubscription.handler.js";
import { ReplaceSubscriptionPlanEntitlementsHandler } from "./commands/replaceSubscriptionPlanEntitlements/replaceSubscriptionPlanEntitlements.handler.js";
import { ReplaceSubscriptionPlanPerksHandler } from "./commands/replaceSubscriptionPlanPerks/replaceSubscriptionPlanPerks.handler.js";
import { ReplaceSubscriptionPlanPricesHandler } from "./commands/replaceSubscriptionPlanPrices/replaceSubscriptionPlanPrices.handler.js";
import { UpdateSubscriptionPlanHandler } from "./commands/updateSubscriptionPlan/updateSubscriptionPlan.handler.js";
import { VerifySubscriptionPaymentHandler } from "./commands/verifySubscriptionPayment/verifySubscriptionPayment.handler.js";
import { FindPreferredPlanCurrencyHandler } from "./queries/findPreferredPlanCurrency/findPreferredPlanCurrency.handler.js";
import { GetMySubscriptionHandler } from "./queries/getMySubscription/getMySubscription.handler.js";
import { GetSellerAccessHandler } from "./queries/getSellerAccess/getSellerAccess.handler.js";
import { GetSubscriptionHandler } from "./queries/getSubscription/getSubscription.handler.js";
import { ListAllSubscriptionPlansHandler } from "./queries/listAllSubscriptionPlans/listAllSubscriptionPlans.handler.js";
import { ListSubscriptionPlansHandler } from "./queries/listSubscriptionPlans/listSubscriptionPlans.handler.js";
import { ListSubscriptionsHandler } from "./queries/listSubscriptions/listSubscriptions.handler.js";
import type { SellerAccessService } from "./services/sellerAccess.service.js";
import type { SubscriptionBillingService } from "./services/subscriptionBilling.service.js";
import type { SubscriptionLifecycleService } from "./services/subscriptionLifecycle.service.js";
import type { SubscriptionPlansService } from "./services/subscriptionPlans.service.js";

export class SubscriptionsModule extends BaseModule {
  public readonly id = "subscriptions";
  public readonly name = "subscriptions";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("subscriptions module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("subscriptions module stopped");
  }
}

export interface SubscriptionServices {
  readonly lifecycle: SubscriptionLifecycleService;
  readonly billing: SubscriptionBillingService;
  readonly plans: SubscriptionPlansService;
  readonly sellerAccess: SellerAccessService;
}

export function registerSubscriptionsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, services: SubscriptionServices): void {
  const { lifecycle, billing, plans, sellerAccess } = services;
  registerCommandHandlers(commands, [
    new CheckoutSubscriptionHandler(billing),
    new VerifySubscriptionPaymentHandler(billing),
    new ChangeOwnSubscriptionHandler(billing),
    new ApplyAdminSubscriptionActionHandler(lifecycle),
    new UpdateSubscriptionPlanHandler(plans),
    new ReplaceSubscriptionPlanPricesHandler(plans),
    new ReplaceSubscriptionPlanEntitlementsHandler(plans),
    new ReplaceSubscriptionPlanPerksHandler(plans),
  ]);
  registerQueryHandlers(queries, [
    new ListSubscriptionPlansHandler(plans),
    new ListAllSubscriptionPlansHandler(plans),
    new GetMySubscriptionHandler(billing),
    new GetSubscriptionHandler(lifecycle),
    new ListSubscriptionsHandler(lifecycle),
    new GetSellerAccessHandler(sellerAccess),
    new FindPreferredPlanCurrencyHandler(billing),
  ]);
}
