import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { CancelCreatorSubscriptionHandler } from "./commands/cancelCreatorSubscription/cancelCreatorSubscription.handler.js";
import { CreateCreatorPlanHandler } from "./commands/createCreatorPlan/createCreatorPlan.handler.js";
import { ResumeCreatorSubscriptionHandler } from "./commands/resumeCreatorSubscription/resumeCreatorSubscription.handler.js";
import { StartCreatorSubscriptionHandler } from "./commands/startCreatorSubscription/startCreatorSubscription.handler.js";
import { UpdateCreatorPlanHandler } from "./commands/updateCreatorPlan/updateCreatorPlan.handler.js";
import { VerifyCreatorSubscriptionPaymentHandler } from "./commands/verifyCreatorSubscriptionPayment/verifyCreatorSubscriptionPayment.handler.js";
import { GetCreatorSubscriptionHandler } from "./queries/getCreatorSubscription/getCreatorSubscription.handler.js";
import { ListCreatorPlansHandler } from "./queries/listCreatorPlans/listCreatorPlans.handler.js";
import { ListCreatorSubscribersHandler } from "./queries/listCreatorSubscribers/listCreatorSubscribers.handler.js";
import { ListMyCreatorSubscriptionsHandler } from "./queries/listMyCreatorSubscriptions/listMyCreatorSubscriptions.handler.js";
import type { CreatorSubscriptionsServices } from "./services/creatorSubscriptionsServices.service.js";

export class CreatorSubscriptionsModule extends BaseModule {
  public readonly id = "creatorSubscriptions";
  public readonly name = "creatorSubscriptions";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("creator subscriptions module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("creator subscriptions module stopped");
  }
}

export function registerCreatorSubscriptionsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, services: CreatorSubscriptionsServices): void {
  registerCommandHandlers(commands, [
    new CreateCreatorPlanHandler(services),
    new UpdateCreatorPlanHandler(services),
    new StartCreatorSubscriptionHandler(services),
    new VerifyCreatorSubscriptionPaymentHandler(services),
    new CancelCreatorSubscriptionHandler(services),
    new ResumeCreatorSubscriptionHandler(services),
  ]);
  registerQueryHandlers(queries, [
    new ListCreatorPlansHandler(services),
    new ListCreatorSubscribersHandler(services),
    new GetCreatorSubscriptionHandler(services),
    new ListMyCreatorSubscriptionsHandler(services),
  ]);
}
